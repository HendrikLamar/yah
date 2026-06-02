import type { SupabaseClient } from '@supabase/supabase-js';

// Account ids the user can access through membership (owned + shared). Used to
// scope account/transaction queries with `.in(...)` as defense-in-depth on top
// of the membership-based RLS — a non-owner member's accounts don't match
// `.eq('user_id', me)`, so membership scoping is mandatory for sharing to work.
export async function getMemberAccountIds(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await db
    .from('account_members')
    .select('account_id')
    .eq('user_id', userId);
  return (data ?? []).map((r) => r.account_id as string);
}
