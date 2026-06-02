-- US-01: user-editable account label. `accounts.name` stays bank-provided and
-- immutable; `display_name` is an optional override shown in the UI
-- (label = display_name ?? name). Nullable, no backfill. The existing
-- "own accounts" RLS policy (for all using auth.uid() = user_id) already
-- authorizes updates to this column, so no policy change is needed.
alter table public.accounts add column display_name text;
