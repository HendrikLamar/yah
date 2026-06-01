-- ============================================================
-- Finanz-Webservice — initial schema
-- Postgres (Supabase). Row Level Security so each user only
-- ever sees their own data. Auth handled by Supabase Auth
-- (auth.users); we reference auth.uid() in policies.
-- ============================================================

-- 1) Profile (1:1 with auth user)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now()
);

-- 2) Bank connections (one GoCardless "requisition" = a consent to one bank)
create table public.bank_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null default 'gocardless',
  institution_id  text not null,              -- e.g. "DKB_BYLADEM1001"
  institution_name text,
  requisition_id  text not null,              -- GoCardless requisition id
  reference       text,                       -- our own reference passed to GC
  -- access token NOT stored: GoCardless manages access server-side via secret.
  -- We store only ids + consent metadata. Consent expires ~90 days (PSD2).
  status          text not null default 'created',  -- created|linked|expired|error
  consent_expires_at timestamptz,
  created_at      timestamptz not null default now()
);

-- 3) Accounts (a connection can expose several accounts)
create table public.accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  connection_id   uuid references public.bank_connections(id) on delete set null,
  gc_account_id   text unique,                -- GoCardless account id
  iban            text,
  name            text not null,              -- "Girokonto", "Tagesgeld", ...
  account_type    text not null default 'giro', -- giro|savings|joint
  owner_label     text,                       -- e.g. "Hendrik", "Hendrik+Sina"
  is_joint        boolean not null default false,
  balance_cents   bigint,                     -- latest known balance
  balance_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- 4) Transactions
create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  account_id      uuid not null references public.accounts(id) on delete cascade,
  gc_transaction_id text,                     -- dedupe key from provider
  booking_date    date not null,
  value_date      date,
  amount_cents    bigint not null,            -- negative = Ausgang
  currency        text not null default 'EUR',
  counterparty    text,                       -- Empfänger/Auftraggeber
  purpose         text,                       -- Verwendungszweck
  counterparty_iban text,
  category        text,                       -- assigned by categorize()
  category_group  text,                       -- Konsum|Einnahmen|Vermögen|Intern|...
  is_internal     boolean not null default false, -- transfer between own accounts
  raw             jsonb,                      -- original provider payload
  created_at      timestamptz not null default now(),
  unique (account_id, gc_transaction_id)
);
create index on public.transactions (user_id, booking_date);
create index on public.transactions (account_id, booking_date);

-- 5) Category rules (user-editable overrides on top of the default rule engine)
create table public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  match_field text not null default 'counterparty', -- counterparty|purpose|iban
  pattern     text not null,                  -- substring / regex
  category    text not null,
  priority    int  not null default 100,
  created_at  timestamptz not null default now()
);

-- 6) Sync log (observability for the scheduled pulls)
create table public.sync_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete cascade,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running', -- running|ok|rate_limited|error
  inserted_count int default 0,
  message       text
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles          enable row level security;
alter table public.bank_connections  enable row level security;
alter table public.accounts          enable row level security;
alter table public.transactions      enable row level security;
alter table public.category_rules    enable row level security;
alter table public.sync_logs         enable row level security;

-- Generic "owner can do everything with their own rows" policy per table.
create policy "own profile"     on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own connections" on public.bank_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own accounts"    on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rules"       on public.category_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own synclogs"    on public.sync_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile row when a new auth user signs up.
create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
