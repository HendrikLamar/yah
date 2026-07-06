-- ============================================================
-- Provider-neutral column names (GoCardless -> Enable Banking).
-- Pure renames + constraint relaxation: data-preserving by
-- construction. UNIQUE constraints ride along with the columns.
-- ============================================================

alter table public.accounts
  rename column gc_account_id to external_account_id;

alter table public.bank_connections
  rename column requisition_id to provider_session_id;

-- Enable Banking has no session id until the callback creates the session.
alter table public.bank_connections
  alter column provider_session_id drop not null;

alter table public.bank_connections
  alter column provider set default 'enablebanking';

alter table public.transactions
  rename column gc_transaction_id to external_transaction_id;
