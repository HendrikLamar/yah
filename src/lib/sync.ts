// Core sync routine: pull transactions for one connection's accounts from
// GoCardless, categorise them, and upsert into Postgres (deduped by
// gc_transaction_id). Shared by the user-triggered route and the cron job.
import { gocardless } from './gocardless';
import { classify } from './categorize';
import type { SupabaseClient } from '@supabase/supabase-js';

const toCents = (s: string) => Math.round(parseFloat(s) * 100);

export async function syncConnection(db: SupabaseClient, userId: string, connectionId: string) {
  const log = await db.from('sync_logs')
    .insert({ user_id: userId, connection_id: connectionId, status: 'running' })
    .select().single();
  const logId = log.data?.id;
  let inserted = 0;

  try {
    const { data: accounts } = await db.from('accounts')
      .select('id, gc_account_id, iban').eq('connection_id', connectionId);

    for (const acc of accounts ?? []) {
      if (!acc.gc_account_id) continue;

      // balances (best-effort)
      try {
        const bal = await gocardless.getBalances(acc.gc_account_id);
        const amount = bal?.balances?.[0]?.balanceAmount?.amount;
        if (amount != null) {
          await db.from('accounts').update({ balance_cents: toCents(amount), balance_at: new Date().toISOString() })
            .eq('id', acc.id);
        }
      } catch { /* balances optional */ }

      const tx = await gocardless.getTransactions(acc.gc_account_id);
      const booked = tx?.transactions?.booked ?? [];
      const ownIbans = new Set((accounts ?? []).map((a: any) => a.iban).filter(Boolean));

      for (const b of booked) {
        const amountCents = toCents(b.transactionAmount.amount);
        const counterparty = b.creditorName ?? b.debtorName ?? '';
        const purpose = (b.remittanceInformationUnstructured
          ?? (b.remittanceInformationUnstructuredArray ?? []).join(' ')) ?? '';
        const cpIban = b.creditorAccount?.iban ?? b.debtorAccount?.iban ?? null;
        const isInternal = !!cpIban && ownIbans.has(cpIban);
        const { category, group } = classify({ counterparty, purpose, amountCents, isInternal });

        const { error } = await db.from('transactions').upsert({
          user_id: userId, account_id: acc.id,
          gc_transaction_id: b.transactionId ?? b.internalTransactionId,
          booking_date: b.bookingDate, value_date: b.valueDate ?? b.bookingDate,
          amount_cents: amountCents, currency: b.transactionAmount.currency ?? 'EUR',
          counterparty, purpose, counterparty_iban: cpIban,
          category, category_group: group, is_internal: isInternal, raw: b,
        }, { onConflict: 'account_id,gc_transaction_id', ignoreDuplicates: true });
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
