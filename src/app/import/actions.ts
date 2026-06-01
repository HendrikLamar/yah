'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseDkbCsv } from '@/lib/dkb-csv';
import { buildImportRows, type AccountRole, type UserRule } from '@/lib/import-dkb';

export interface ImportState { ok: boolean; message: string; }

const roleOf = (accountType: string, isJoint: boolean): AccountRole =>
  isJoint || accountType === 'joint' ? 'joint' : accountType === 'savings' ? 'savings' : 'giro';

export async function importDkbCsv(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const db = createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, message: 'Nicht angemeldet.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Bitte eine CSV-Datei auswählen.' };

  let parse;
  try { parse = parseDkbCsv(await file.text()); }
  catch (e) { return { ok: false, message: `CSV konnte nicht gelesen werden: ${String((e as Error).message)}` }; }
  if (!parse.rows.length) return { ok: false, message: 'Keine Buchungen in der Datei gefunden.' };

  const mode = String(formData.get('mode') ?? 'existing');
  const partnerName = (String(formData.get('partner_name') ?? '').trim()) || null;

  let account: { id: string; iban: string | null; account_type: string; is_joint: boolean } | null = null;

  if (mode === 'new') {
    const accountType = String(formData.get('account_type') ?? 'giro');
    const isJoint = accountType === 'joint';
    const name = (String(formData.get('name') ?? '').trim()) || 'Importiertes Konto';
    const ownerLabel = (String(formData.get('owner_label') ?? '').trim()) || null;
    const ins = await db.from('accounts').insert({
      user_id: user.id, iban: parse.iban, name, account_type: accountType,
      is_joint: isJoint, owner_label: ownerLabel,
    }).select('id, iban, account_type, is_joint').single();
    if (ins.error || !ins.data) return { ok: false, message: `Konto konnte nicht angelegt werden: ${ins.error?.message}` };
    account = ins.data;
  } else {
    const id = String(formData.get('account_id') ?? '');
    if (!id) return { ok: false, message: 'Bitte ein Zielkonto wählen.' };
    const sel = await db.from('accounts').select('id, iban, account_type, is_joint')
      .eq('id', id).eq('user_id', user.id).single();
    if (sel.error || !sel.data) return { ok: false, message: 'Zielkonto nicht gefunden.' };
    account = sel.data;
  }

  const { data: allAccounts } = await db.from('accounts').select('iban').eq('user_id', user.id);
  const ownIbans = new Set<string>(
    (allAccounts ?? []).map((a) => a.iban).filter((x): x is string => !!x && x !== account!.iban),
  );

  const { data: ruleRows } = await db.from('category_rules')
    .select('match_field, pattern, category, priority').eq('user_id', user.id);
  const rules = (ruleRows ?? []) as UserRule[];

  const rows = buildImportRows({
    rows: parse.rows,
    accountRole: roleOf(account.account_type, account.is_joint),
    ownIbans, partnerName, rules,
  });

  const payload = rows.map((r) => ({ ...r, user_id: user.id, account_id: account!.id, value_date: r.booking_date }));
  const { error } = await db.from('transactions')
    .upsert(payload, { onConflict: 'account_id,gc_transaction_id', ignoreDuplicates: true });
  if (error) return { ok: false, message: `Import fehlgeschlagen: ${error.message}` };

  if (parse.balanceCents != null) {
    await db.from('accounts').update({
      balance_cents: parse.balanceCents,
      balance_at: parse.balanceDate ? new Date(parse.balanceDate).toISOString() : new Date().toISOString(),
    }).eq('id', account.id).eq('user_id', user.id);
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
