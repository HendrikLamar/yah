-- ============================================================
-- Epic #28 piece 2 — cross-user account sharing.
-- Accounts become multi-member: `accounts.user_id` stays the owner/importer
-- pointer; a new `account_members` table governs *access*. RLS on accounts +
-- transactions is rewritten from owner-based to membership-based via
-- SECURITY DEFINER helpers (which read account_members bypassing its own RLS,
-- breaking the policy-recursion cycle). All membership/invitation mutations go
-- through SECURITY DEFINER RPCs; the tables are SELECT-only for clients.
-- "Shared" is redefined as member_count > 1 (is_joint left untouched, legacy).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tables
-- ------------------------------------------------------------
create table public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id)      on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

create table public.account_invitations (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references public.accounts(id) on delete cascade,
  inviter_id   uuid not null references auth.users(id)      on delete cascade,
  invitee_id   uuid not null references auth.users(id)      on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending','accepted','declined','revoked')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

-- At most one *pending* invite per (account, invitee). Declined/revoked rows
-- don't block a fresh re-invite.
create unique index account_invitations_pending_uq
  on public.account_invitations (account_id, invitee_id)
  where status = 'pending';

-- ------------------------------------------------------------
-- 2) Backfill owner memberships from existing accounts.
--    MUST run before the auto-membership trigger exists so existing rows
--    aren't double-handled.
-- ------------------------------------------------------------
insert into public.account_members (account_id, user_id, role)
select id, user_id, 'owner' from public.accounts
on conflict do nothing;

-- ------------------------------------------------------------
-- 3) Auto-create an owner membership whenever an account is created
--    (fires for anon-, service-role-, and definer-originated inserts).
-- ------------------------------------------------------------
create function public.handle_account_created() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.account_members (account_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict do nothing;
  return new;
end; $$;

create trigger on_account_created
  after insert on public.accounts
  for each row execute procedure public.handle_account_created();

-- ------------------------------------------------------------
-- 4) Membership helpers. SECURITY DEFINER so they read account_members
--    bypassing its RLS — this is what breaks the accounts/transactions
--    policy recursion.
-- ------------------------------------------------------------
create function public.is_account_member(aid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = aid and m.user_id = auth.uid()
  );
$$;

create function public.is_account_owner(aid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = aid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- ------------------------------------------------------------
-- 5) RLS rewrite: accounts + transactions become membership-based.
--    The `auth.uid() = user_id` disjunct guarantees the owner can always SELECT
--    their just-inserted row (INSERT ... RETURNING) without depending on the
--    AFTER-INSERT membership trigger having committed first. The owner is always
--    a member, so this never widens access beyond membership.
-- ------------------------------------------------------------
drop policy "own accounts" on public.accounts;
create policy "members select accounts" on public.accounts
  for select using (auth.uid() = user_id or public.is_account_member(id));
create policy "insert own accounts" on public.accounts
  for insert with check (auth.uid() = user_id);
create policy "owners update accounts" on public.accounts
  for update using (public.is_account_owner(id)) with check (public.is_account_owner(id));
create policy "owners delete accounts" on public.accounts
  for delete using (public.is_account_owner(id));

drop policy "own transactions" on public.transactions;
create policy "members select transactions" on public.transactions
  for select using (auth.uid() = user_id or public.is_account_member(account_id));
create policy "members insert transactions" on public.transactions
  for insert with check (public.is_account_member(account_id) and auth.uid() = user_id);
create policy "members update transactions" on public.transactions
  for update using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));
create policy "members delete transactions" on public.transactions
  for delete using (public.is_account_member(account_id));

-- ------------------------------------------------------------
-- 6) RLS for the new tables: SELECT-only for clients; all writes via RPC.
-- ------------------------------------------------------------
alter table public.account_members     enable row level security;
alter table public.account_invitations enable row level security;

create policy "members see co-members" on public.account_members
  for select using (public.is_account_member(account_id));

create policy "invitee sees own invitations" on public.account_invitations
  for select using (invitee_id = auth.uid());
create policy "owner sees account invitations" on public.account_invitations
  for select using (public.is_account_owner(account_id));

-- ------------------------------------------------------------
-- 7) Mutation RPCs (all SECURITY DEFINER, re-check auth.uid()/role internally).
-- ------------------------------------------------------------

-- Rename the shared label. Any member may rename; only display_name changes
-- (the accounts UPDATE policy is owner-only, so members can't do a direct update).
create function public.rename_account(p_account_id uuid, p_display_name text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_account_member(p_account_id) then
    raise exception 'not a member of this account';
  end if;
  update public.accounts
    set display_name = nullif(left(btrim(p_display_name), 60), '')
    where id = p_account_id;
end; $$;

-- Invite by email, OPAQUE: always returns void. The caller learns nothing about
-- whether the email is registered, already a member, or already invited.
create function public.invite_to_account(p_account_id uuid, p_email text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_invitee uuid;
begin
  if not public.is_account_owner(p_account_id) then
    raise exception 'not the owner of this account';
  end if;
  select id into v_invitee from auth.users
    where lower(email) = lower(btrim(p_email)) limit 1;
  if v_invitee is null then return; end if;                    -- unknown email
  if exists (select 1 from public.account_members
             where account_id = p_account_id and user_id = v_invitee) then
    return;                                                    -- already a member (incl. self)
  end if;
  insert into public.account_invitations (account_id, inviter_id, invitee_id, status)
  values (p_account_id, auth.uid(), v_invitee, 'pending')
  on conflict (account_id, invitee_id) where status = 'pending' do nothing;  -- already pending
end; $$;

-- Invitee accepts/declines their own pending invitation.
create function public.respond_to_invitation(p_invitation_id uuid, p_accept boolean)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_invitee uuid;
begin
  select account_id, invitee_id into v_account, v_invitee
    from public.account_invitations
    where id = p_invitation_id and status = 'pending';
  if v_account is null then raise exception 'invitation not found'; end if;
  if v_invitee <> auth.uid() then raise exception 'not your invitation'; end if;

  update public.account_invitations
    set status = case when p_accept then 'accepted' else 'declined' end,
        responded_at = now()
    where id = p_invitation_id;

  if p_accept then
    insert into public.account_members (account_id, user_id, role)
    values (v_account, auth.uid(), 'member')
    on conflict do nothing;
  end if;
end; $$;

-- Owner revokes a pending invitation they sent.
create function public.revoke_invitation(p_invitation_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
begin
  select account_id into v_account
    from public.account_invitations
    where id = p_invitation_id and status = 'pending';
  if v_account is null then raise exception 'invitation not found'; end if;
  if not public.is_account_owner(v_account) then
    raise exception 'not the owner of this account';
  end if;
  update public.account_invitations
    set status = 'revoked', responded_at = now()
    where id = p_invitation_id;
end; $$;

-- Owner removes a (non-owner) member.
create function public.remove_member(p_account_id uuid, p_user_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_account_owner(p_account_id) then
    raise exception 'not the owner of this account';
  end if;
  delete from public.account_members
    where account_id = p_account_id and user_id = p_user_id and role = 'member';
end; $$;

-- A non-owner member leaves an account. The owner cannot leave (would orphan it).
create function public.leave_account(p_account_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_role text;
begin
  select role into v_role from public.account_members
    where account_id = p_account_id and user_id = auth.uid();
  if v_role is null then raise exception 'not a member of this account'; end if;
  if v_role = 'owner' then raise exception 'owner cannot leave the account'; end if;
  delete from public.account_members
    where account_id = p_account_id and user_id = auth.uid();
end; $$;

-- ------------------------------------------------------------
-- 8) Read RPCs that need auth.users email (member-/owner-gated internally).
-- ------------------------------------------------------------
create function public.list_account_members(p_account_id uuid)
  returns table (user_id uuid, email text, role text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_account_member(p_account_id) then
    raise exception 'not a member of this account';
  end if;
  return query
    select m.user_id, u.email::text, m.role
    from public.account_members m
    join auth.users u on u.id = m.user_id
    where m.account_id = p_account_id
    order by (m.role = 'owner') desc, u.email;
end; $$;

-- Pending invitations addressed to the current user (incoming).
create function public.my_invitations()
  returns table (invitation_id uuid, account_id uuid, account_label text,
                 inviter_email text, created_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select i.id, i.account_id,
         coalesce(a.display_name, a.name) as account_label,
         u.email::text as inviter_email,
         i.created_at
  from public.account_invitations i
  join public.accounts a on a.id = i.account_id
  join auth.users u on u.id = i.inviter_id
  where i.invitee_id = auth.uid() and i.status = 'pending'
  order by i.created_at desc;
$$;

-- Pending invitations on an account the caller owns (outgoing). Returning the
-- invitee email to the owner is not enumeration — they typed it themselves.
create function public.list_account_invitations(p_account_id uuid)
  returns table (invitation_id uuid, invitee_email text, created_at timestamptz)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_account_owner(p_account_id) then
    raise exception 'not the owner of this account';
  end if;
  return query
    select i.id, u.email::text, i.created_at
    from public.account_invitations i
    join auth.users u on u.id = i.invitee_id
    where i.account_id = p_account_id and i.status = 'pending'
    order by i.created_at desc;
end; $$;

-- ------------------------------------------------------------
-- 9) Grants. Client-facing RPCs + helpers callable by authenticated users.
-- ------------------------------------------------------------
grant execute on function public.is_account_member(uuid)        to authenticated;
grant execute on function public.is_account_owner(uuid)         to authenticated;
grant execute on function public.rename_account(uuid, text)     to authenticated;
grant execute on function public.invite_to_account(uuid, text)  to authenticated;
grant execute on function public.respond_to_invitation(uuid, boolean) to authenticated;
grant execute on function public.revoke_invitation(uuid)        to authenticated;
grant execute on function public.remove_member(uuid, uuid)      to authenticated;
grant execute on function public.leave_account(uuid)            to authenticated;
grant execute on function public.list_account_members(uuid)     to authenticated;
grant execute on function public.my_invitations()               to authenticated;
grant execute on function public.list_account_invitations(uuid) to authenticated;
