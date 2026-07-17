import type { SupabaseClient } from '@supabase/supabase-js';

export interface Membership { account_id: string; hidden: boolean; }

// The user's membership rows (owned + shared accounts) incl. their personal
// dashboard-hide flag. Base primitive for account scoping: membership-based
// `.in(...)` filters are mandatory defense-in-depth on top of RLS — a
// non-owner member's accounts don't match `.eq('user_id', me)`.
export async function getMemberships(db: SupabaseClient, userId: string): Promise<Membership[]> {
  const { data } = await db
    .from('account_members')
    .select('account_id, hidden')
    .eq('user_id', userId);
  return (data ?? []).map((r) => ({ account_id: r.account_id as string, hidden: !!r.hidden }));
}

// All member account ids, hidden ones included — hiding is a dashboard-only
// concern; sync/import/accounts must keep operating on hidden accounts.
export async function getMemberAccountIds(db: SupabaseClient, userId: string): Promise<string[]> {
  return (await getMemberships(db, userId)).map((m) => m.account_id);
}
