// Thin wrapper around the GoCardless Bank Account Data API (PSD2 aggregator).
// Docs: https://developer.gocardless.com/bank-account-data/
//
// Flow:
//   1) getAccessToken()                  -> short-lived bearer
//   2) listInstitutions('DE')            -> pick the bank (e.g. DKB)
//   3) createRequisition(institutionId)  -> returns a hosted consent `link`
//      user is redirected there, authenticates with their bank (SCA)
//   4) getRequisition(id)                -> after redirect: list of account ids
//   5) getTransactions(accountId)        -> booked + pending transactions
//
// IMPORTANT: banks rate-limit to ~4 calls/day per access scope per account,
// so sync on a schedule (see vercel.json cron = every 6h) and cache results.

const BASE = process.env.GOCARDLESS_BASE_URL ?? 'https://bankaccountdata.gocardless.com/api/v2';

let cachedToken: { access: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 30_000) return cachedToken.access;
  const res = await fetch(`${BASE}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret_id: process.env.GOCARDLESS_SECRET_ID,
      secret_key: process.env.GOCARDLESS_SECRET_KEY,
    }),
  });
  if (!res.ok) throw new Error(`GoCardless token error ${res.status}`);
  const j = await res.json();
  cachedToken = { access: j.access, exp: Date.now() + (j.access_expires ?? 3600) * 1000 };
  return j.access;
}

async function gcFetch(path: string, init: RequestInit = {}) {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  if (res.status === 429) {
    const reset = res.headers.get('HTTP_X_RATELIMIT_RESET') ?? res.headers.get('x-ratelimit-reset');
    const err: any = new Error('GoCardless rate limited'); err.rateLimited = true; err.reset = reset;
    throw err;
  }
  if (!res.ok) throw new Error(`GoCardless ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

export const gocardless = {
  listInstitutions: (country = 'DE') => gcFetch(`/institutions/?country=${country}`),

  // reference lets us tie the callback back to our bank_connections row.
  createRequisition: (institutionId: string, redirect: string, reference: string) =>
    gcFetch('/requisitions/', {
      method: 'POST',
      body: JSON.stringify({ institution_id: institutionId, redirect, reference, user_language: 'DE' }),
    }),

  getRequisition: (id: string) => gcFetch(`/requisitions/${id}/`),
  getAccountDetails: (accountId: string) => gcFetch(`/accounts/${accountId}/details/`),
  getBalances: (accountId: string) => gcFetch(`/accounts/${accountId}/balances/`),
  getTransactions: (accountId: string) => gcFetch(`/accounts/${accountId}/transactions/`),
};
