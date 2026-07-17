// Thin wrapper around the Enable Banking API (PSD2 aggregator, Berlin-Group
// harmonized). Docs: https://enablebanking.com/docs/api/reference/
//
// Flow:
//   1) listAspsps('DE')        -> banks available in a country
//   2) startAuth({...})        -> hosted consent `url`; user authenticates (SCA)
//   3) createSession(code)     -> after redirect: session id + account uids
//   4) getTransactions(uid)    -> booked transactions (paginated)
//
// Auth is a per-request RS256 JWT signed with the application's RSA private
// key — stateless, so no token caching. Field names below follow Enable
// Banking's harmonized data model; if the first live connect shows a
// discrepancy, correct it inside mapTransaction/pickBalanceCents only.
import { createSign } from 'node:crypto';

const BASE = process.env.ENABLE_BANKING_BASE_URL ?? 'https://api.enablebanking.com';

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function buildJwt(): string {
  const appId = process.env.ENABLE_BANKING_APPLICATION_ID;
  const keyB64 = process.env.ENABLE_BANKING_PRIVATE_KEY_B64;
  if (!appId || !keyB64) throw new Error('Enable Banking credentials missing (ENABLE_BANKING_APPLICATION_ID / ENABLE_BANKING_PRIVATE_KEY_B64)');

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId }));
  const payload = b64url(JSON.stringify({
    iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const signature = b64url(signer.sign(Buffer.from(keyB64, 'base64').toString('utf8')));
  return `${header}.${payload}.${signature}`;
}

async function ebFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${buildJwt()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 429) {
    const err: any = new Error('Enable Banking rate limited');
    err.rateLimited = true; err.reset = res.headers.get('retry-after');
    throw err;
  }
  if (!res.ok) throw new Error(`Enable Banking ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

export interface Aspsp {
  name: string;
  country: string;
  logo?: string;
  maximum_consent_validity?: number; // seconds
  beta?: boolean;
}

export interface SessionAccount {
  uid: string;
  iban: string | null;
  name: string;
}

// POST /sessions returns `accounts` either as detailed objects or as plain
// uid strings depending on API revision — normalize both so the callback
// route stays shape-agnostic.
async function normalizeAccount(a: any): Promise<SessionAccount> {
  const details = typeof a === 'string' ? await ebFetch(`/accounts/${a}/details`).catch(() => ({})) : a;
  const uid = typeof a === 'string' ? a : a.uid;
  return {
    uid,
    iban: details.account_id?.iban ?? null,
    name: details.name ?? details.product ?? 'Konto',
  };
}

export const enablebanking = {
  listAspsps: async (country = 'DE'): Promise<Aspsp[]> => {
    const j = await ebFetch(`/aspsps?country=${encodeURIComponent(country)}`);
    return j.aspsps ?? [];
  },

  // state lets us tie the callback back to our bank_connections row.
  startAuth: async (args: {
    aspsp: string; country: string; redirect: string; state: string; validUntil: string;
  }): Promise<{ url: string }> =>
    ebFetch('/auth', {
      method: 'POST',
      body: JSON.stringify({
        access: { valid_until: args.validUntil },
        aspsp: { name: args.aspsp, country: args.country },
        state: args.state,
        redirect_url: args.redirect,
        psu_type: 'personal',
      }),
    }),

  createSession: async (code: string): Promise<{ session_id: string; accounts: SessionAccount[] }> => {
    const j = await ebFetch('/sessions', { method: 'POST', body: JSON.stringify({ code }) });
    const accounts: SessionAccount[] = [];
    for (const a of j.accounts ?? []) accounts.push(await normalizeAccount(a));
    return { session_id: j.session_id, accounts };
  },

  getBalances: async (accountUid: string): Promise<any[]> => {
    const j = await ebFetch(`/accounts/${accountUid}/balances`);
    return j.balances ?? [];
  },

  getTransactions: async (accountUid: string, dateFrom?: string): Promise<any[]> => {
    const all: any[] = [];
    let continuationKey: string | undefined;
    // Bounded continuation loop — a runaway guard, NOT a data limit. Mock
    // ASPSP pages in batches of 10, so full histories span hundreds of
    // pages; the bound must comfortably exceed any real account history.
    for (let page = 0; page < 500; page++) {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (continuationKey) params.set('continuation_key', continuationKey);
      const q = params.size ? `?${params}` : '';
      const j = await ebFetch(`/accounts/${accountUid}/transactions${q}`);
      all.push(...(j.transactions ?? []));
      continuationKey = j.continuation_key;
      if (!continuationKey) break;
    }
    return all;
  },
};

// ---------------------------------------------------------------------------
// Pure mappers (unit-tested). All knowledge about Enable Banking's harmonized
// transaction/balance shapes lives here so a field-name correction after the
// first live connect is a one-place edit.
// ---------------------------------------------------------------------------

const toCents = (s: string) => Math.round(parseFloat(s) * 100);

export interface MappedTransaction {
  external_transaction_id: string;
  booking_date: string;
  value_date: string;
  amount_cents: number;
  currency: string;
  counterparty: string;
  purpose: string;
  counterparty_iban: string | null;
  is_internal: boolean;
}

// entry_reference is NOT unique per transaction: Enable Banking's own
// synthetic bank data shares one reference across whole payment batches
// (44 MobilePay payments under a single reference). The dedupe key is
// therefore reference + a hash over the identifying content; fully identical
// rows get an occurrence suffix in mapTransactions (order-independent, so
// re-syncs upsert onto the same keys).
function contentHash(key: string): string {
  let h1 = 5381;        // djb2
  let h2 = 0x811c9dc5;  // fnv-1a
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = (((h1 << 5) + h1) ^ c) >>> 0;
    h2 = ((h2 ^ c) * 0x01000193) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}

// Amounts are positive with the sign carried by credit_debit_indicator
// (unlike GoCardless, whose amount was signed). Tolerate signed input by
// normalizing via abs before applying the indicator.
export function mapTransaction(tx: any, ownIbans: Set<string>): MappedTransaction | null {
  const reference = tx.entry_reference ?? tx.transaction_id;
  const bookingDate = tx.booking_date;
  if (!reference || !bookingDate) return null;

  const rawCents = toCents(tx.transaction_amount?.amount ?? '0');
  const indicator = tx.credit_debit_indicator;
  const amountCents = indicator === 'DBIT' ? -Math.abs(rawCents)
    : indicator === 'CRDT' ? Math.abs(rawCents)
    : rawCents;

  const counterpartyIban = tx.creditor_account?.iban ?? tx.debtor_account?.iban ?? null;
  const counterparty = tx.creditor?.name ?? tx.debtor?.name ?? '';
  const purpose = (tx.remittance_information ?? []).join(' ');
  const currency = tx.transaction_amount?.currency ?? 'EUR';

  const hash = contentHash(
    [bookingDate, amountCents, currency, counterparty, purpose, counterpartyIban ?? ''].join('|'),
  );

  return {
    external_transaction_id: `${reference}_${hash}`,
    booking_date: bookingDate,
    value_date: tx.value_date ?? bookingDate,
    amount_cents: amountCents,
    currency,
    counterparty,
    purpose,
    counterparty_iban: counterpartyIban,
    is_internal: !!counterpartyIban && ownIbans.has(counterpartyIban),
  };
}

// Batch mapper used by sync: adds occurrence suffixes so fully identical
// rows (same reference AND same content) stay distinct. Suffixes are
// assigned per identical-content group, so the key SET is independent of
// the order the API returned the rows in — re-syncs stay idempotent.
// `raw` carries the original payload for the transactions.raw jsonb column.
export function mapTransactions(txs: any[], ownIbans: Set<string>): (MappedTransaction & { raw: any })[] {
  const seen = new Map<string, number>();
  const out: (MappedTransaction & { raw: any })[] = [];
  for (const tx of txs) {
    const m = mapTransaction(tx, ownIbans);
    if (!m) continue;
    const occ = seen.get(m.external_transaction_id) ?? 0;
    seen.set(m.external_transaction_id, occ + 1);
    if (occ > 0) m.external_transaction_id = `${m.external_transaction_id}_${occ}`;
    out.push({ ...m, raw: tx });
  }
  return out;
}

const BALANCE_PREFERENCE = ['CLBD', 'ITAV', 'ITBD', 'XPCD'];

export function pickBalanceCents(balances: any[]): number | null {
  if (!balances?.length) return null;
  const usable = balances.filter((b) => b.balance_amount?.amount != null);
  if (!usable.length) return null;
  for (const type of BALANCE_PREFERENCE) {
    const hit = usable.find((b) => b.balance_type === type);
    if (hit) return toCents(hit.balance_amount.amount);
  }
  return toCents(usable[0].balance_amount.amount);
}
