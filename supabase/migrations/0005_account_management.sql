-- ============================================================
-- Account management — per-member hide flag.
-- `hidden` lives on the membership row, not the account: on a shared
-- account one member hiding it must not blank the other member's
-- dashboard. account_members intentionally has NO client UPDATE policy
-- (a generic one would let members escalate `role`), so the toggle goes
-- through a SECURITY DEFINER RPC that touches only the caller's own row
-- and only this column — same writes-via-RPC pattern as 0003.
-- Account/connection deletion needs no schema change: `owners delete
-- accounts` (0003) and `own connections` (0001) already authorize it.
-- ============================================================

alter table public.account_members
  add column hidden boolean not null default false;

create function public.set_account_hidden(p_account_id uuid, p_hidden boolean)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if p_hidden is null then
    raise exception 'hidden flag must be true or false';
  end if;
  if not exists (
    select 1 from public.account_members
    where account_id = p_account_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of this account';
  end if;
  update public.account_members
    set hidden = p_hidden
    where account_id = p_account_id and user_id = auth.uid();
end; $$;

revoke execute on function public.set_account_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_account_hidden(uuid, boolean) to authenticated;
