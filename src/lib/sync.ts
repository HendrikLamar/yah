// Core sync routine: pull transactions for one connection's accounts from
// Enable Banking, categorise them, and upsert into Postgres (deduped by
// external_transaction_id). Shared by the user-triggered route and the
// in-stack cron job.
import { enablebanking, mapTransaction, pickBalanceCents } from './enablebanking';
import { classifyPersonal } from './categorize';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function syncConnection(db: SupabaseClient, userId: string, connectionId: string) {
  const log = await db.from('sync_logs')
    .insert({ user_id: userId, connection_id: connectionId, status: 'running' })
    .select().single();
  const logId = log.data?.id;
  let inserted = 0;

  try {
    const { data: conn } = await db.from('bank_connections')
      .select('id, consent_expires_at').eq('id', connectionId).eq('user_id', userId).single();
    if (!conn) throw new Error('connection not found');
    if (conn.consent_expires_at && new Date(conn.consent_expires_at) < new Date()) {
      await db.from('bank_connections').update({ status: 'expired' })
        .eq('id', conn.id).eq('user_id', userId);
      if (logId) await db.from('sync_logs').update({
        status: 'ok', finished_at: new Date().toISOString(), message: 'consent expired — connection marked expired, sync skipped',
      }).eq('id', logId);
      return { ok: true, inserted: 0, expired: true };
    }

    const { data: accounts } = await db.from('accounts')
      .select('id, external_account_id, iban')
      .eq('connection_id', connectionId).eq('user_id', userId);
    const ownIbans = new Set((accounts ?? []).map((a: any) => a.iban).filter(Boolean));

    for (const acc of accounts ?? []) {
      if (!acc.external_account_id) continue;

      // balances (best-effort)
      try {
        const cents = pickBalanceCents(await enablebanking.getBalances(acc.external_account_id));
        if (cents != null) {
          await db.from('accounts').update({ balance_cents: cents, balance_at: new Date().toISOString() })
            .eq('id', acc.id).eq('user_id', userId);
        }
      } catch { /* balances optional */ }

      const transactions = await enablebanking.getTransactions(acc.external_account_id);
      // booked only; tolerate responses that omit status entirely
      const booked = transactions.filter((t) => !t.status || t.status === 'BOOK');

      for (const t of booked) {
        const m = mapTransaction(t, ownIbans);
        if (!m) continue;
        const { category, group } = classifyPersonal({
          counterparty: m.counterparty, purpose: m.purpose,
          amountCents: m.amount_cents, isInternal: m.is_internal,
        });

        const { error } = await db.from('transactions').upsert({
          user_id: userId, account_id: acc.id, ...m,
          category, category_group: group, raw: t,
        }, { onConflict: 'account_id,external_transaction_id', ignoreDuplicates: true });
        if (!error) inserted += 1;
      }
    }

    if (logId) await db.from('sync_logs').update({
      status: 'ok', finished_at: new Date().toISOString(), inserted_count: inserted,
    }).eq('id', logId);
    return { ok: true, inserted };
  } catch (e: any) {
    if (logId) await db.from('sync_logs').update({
      status: e.rateLimited ? 'rate_limited' : 'error',
      finished_at: new Date().toISOString(), message: String(e.message ?? e),
    }).eq('id', logId);
    return { ok: false, error: String(e.message ?? e), rateLimited: !!e.rateLimited };
  }
}
