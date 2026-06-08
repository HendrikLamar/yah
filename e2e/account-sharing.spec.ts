import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^#]*)/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost';
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'x';
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY ?? 'x';
const hasCreds = !!(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const t = hasCreds ? test : test.skip;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const password = 'Test-Password-123!';
const stamp = Date.now();
const emailA = `e2e-owner+${stamp}@yah-itest.local`;
const emailB = `e2e-invitee+${stamp}@yah-itest.local`;
let userA = '';
let userB = '';
let aClient: SupabaseClient;
let bClient: SupabaseClient;

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

let ibanSeq = 0;
async function seedAccount(name: string): Promise<string> {
  const iban = `DE${String(10 ** 19 + ibanSeq++).slice(0, 20)}`;
  const { data, error } = await admin.from('accounts').insert({
    user_id: userA, name, account_type: 'giro', iban, balance_cents: 500000,
  }).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

async function seedTransactions(accountId: string, userId: string): Promise<number> {
  const rows = [
    { user_id: userId, account_id: accountId, gc_transaction_id: `${accountId}-1`,
      booking_date: '2025-06-15', amount_cents: -4250, counterparty: 'REWE SAGT DANKE',
      purpose: 'Einkauf', category: 'Lebensmittel & Drogerie', category_group: 'Konsum' },
    { user_id: userId, account_id: accountId, gc_transaction_id: `${accountId}-2`,
      booking_date: '2025-06-28', amount_cents: 300000, counterparty: 'ARBEITGEBER GMBH',
      purpose: 'Gehalt Juni', category: 'Einnahmen · Gehalt', category_group: 'Einnahmen' },
    { user_id: userId, account_id: accountId, gc_transaction_id: `${accountId}-3`,
      booking_date: '2025-06-03', amount_cents: -120000, counterparty: 'Vermieter',
      purpose: 'Miete Juni', category: 'Miete', category_group: 'Konsum' },
  ];
  const { error } = await admin.from('transactions').insert(rows);
  if (error) throw error;
  return rows.length;
}

async function loginUI(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByPlaceholder('E-Mail').fill(email);
  await page.getByPlaceholder('Passwort').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard');
}

// Master-detail: the rename/invite/members controls only exist for the selected
// account, so a test must pick its target in the left list before interacting.
async function selectAccount(page: import('@playwright/test').Page, name: string) {
  await page.locator('.ap-item', { hasText: name }).click();
}

test.beforeAll(async () => {
  if (!hasCreds) return;
  const ra = await admin.auth.admin.createUser({ email: emailA, password, email_confirm: true });
  if (ra.error) throw ra.error;
  userA = ra.data.user!.id;
  const rb = await admin.auth.admin.createUser({ email: emailB, password, email_confirm: true });
  if (rb.error) throw rb.error;
  userB = rb.data.user!.id;
  aClient = await signIn(emailA);
  bClient = await signIn(emailB);
});

test.afterAll(async () => {
  if (userA) await admin.auth.admin.deleteUser(userA);
  if (userB) await admin.auth.admin.deleteUser(userB);
});

t('owner invites by email; invitee accepts, sees the shared account + transactions + badge; rename reflects to both', async ({ page, browser }) => {
  const accountId = await seedAccount('Girokonto');
  const txCount = await seedTransactions(accountId, userA);

  // Before any invite, B cannot see A's account or transactions (RLS).
  const beforeAcc = await bClient.from('accounts').select('id').eq('id', accountId);
  expect(beforeAcc.data ?? []).toHaveLength(0);
  const beforeTx = await bClient.from('transactions').select('*', { count: 'exact', head: true }).eq('account_id', accountId);
  expect(beforeTx.count ?? 0).toBe(0);

  // A invites B through the UI.
  await loginUI(page, emailA);
  await page.goto('/accounts');
  await selectAccount(page, 'Girokonto');
  await page.getByLabel('E-Mail-Adresse einladen').fill(emailB);
  await page.getByRole('button', { name: 'Einladen' }).click();
  await expect(page.getByText('Einladung gesendet.')).toBeVisible();

  // Invitation row exists and is pending.
  const pend = await admin.from('account_invitations').select('id, status')
    .eq('account_id', accountId).eq('invitee_id', userB);
  expect(pend.data).toHaveLength(1);
  expect(pend.data![0].status).toBe('pending');

  // B logs in (separate context) and accepts.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await loginUI(pageB, emailB);
  await pageB.goto('/accounts');
  await expect(pageB.getByText(emailA)).toBeVisible();
  await pageB.getByRole('button', { name: 'Annehmen' }).click();
  // Wait for the accept to actually land: after refresh the pending invitation
  // is gone, so the whole "Einladungen" section unmounts. (The button label
  // flips to "…" optimistically, so asserting on its absence would race the RPC.)
  await expect(pageB.getByRole('heading', { name: 'Einladungen' })).toHaveCount(0);

  // B is now a member and sees A's transactions.
  const mem = await admin.from('account_members').select('user_id, role').eq('account_id', accountId);
  expect(mem.data).toHaveLength(2);
  const bSees = await bClient.from('transactions').select('*', { count: 'exact', head: true }).eq('account_id', accountId);
  expect(bSees.count).toBe(txCount);

  // B's dashboard shows the account tab with the shared badge.
  await pageB.goto('/dashboard');
  await expect(pageB.locator('.tabbtn').first()).toBeVisible();
  await expect(pageB.locator('.shared-badge').first()).toBeVisible();

  // B (non-owner) renames; the shared label updates for both.
  await pageB.goto('/accounts');
  await selectAccount(pageB, 'Girokonto');
  await pageB.getByLabel('Anzeigename für Girokonto').fill('Unser Haushaltskonto');
  await pageB.getByRole('button', { name: 'Speichern' }).click();
  await expect(pageB.getByText('gespeichert')).toBeVisible();
  await expect.poll(async () => {
    const r = await admin.from('accounts').select('display_name').eq('id', accountId).single();
    return r.data?.display_name;
  }).toBe('Unser Haushaltskonto');

  await ctxB.close();
});

t('opaque invite: inviting a non-existent email succeeds with a neutral confirmation and creates no invitation', async ({ page }) => {
  const accountId = await seedAccount('Opaque-Konto');
  await loginUI(page, emailA);
  await page.goto('/accounts');
  // A may own several accounts by now; pick this one and invite a ghost — the
  // email resolves to no user, so no invitation row is created on any account.
  await selectAccount(page, 'Opaque-Konto');
  await page.getByLabel('E-Mail-Adresse einladen').fill(`ghost-${stamp}@nowhere.invalid`);
  await page.getByRole('button', { name: 'Einladen' }).click();
  await expect(page.getByText('Einladung gesendet.')).toBeVisible();

  const rows = await admin.from('account_invitations').select('id').eq('account_id', accountId);
  expect(rows.data ?? []).toHaveLength(0);
});

t('decline: invitee declines; no membership is created and status is declined', async () => {
  const accountId = await seedAccount('Decline-Konto');
  await aClient.rpc('invite_to_account', { p_account_id: accountId, p_email: emailB });
  const inv = await bClient.rpc('my_invitations');
  const row = (inv.data as any[]).find((r) => r.account_id === accountId);
  expect(row).toBeTruthy();

  const res = await bClient.rpc('respond_to_invitation', { p_invitation_id: row.invitation_id, p_accept: false });
  expect(res.error).toBeNull();

  const mem = await admin.from('account_members').select('user_id').eq('account_id', accountId).eq('user_id', userB);
  expect(mem.data ?? []).toHaveLength(0);
  const st = await admin.from('account_invitations').select('status').eq('id', row.invitation_id).single();
  expect(st.data!.status).toBe('declined');
});

t('revoke: owner revokes a pending invite before response; it disappears for the invitee', async () => {
  const accountId = await seedAccount('Revoke-Konto');
  await aClient.rpc('invite_to_account', { p_account_id: accountId, p_email: emailB });
  const before = (await bClient.rpc('my_invitations')).data as any[];
  const row = before.find((r) => r.account_id === accountId);
  expect(row).toBeTruthy();

  const res = await aClient.rpc('revoke_invitation', { p_invitation_id: row.invitation_id });
  expect(res.error).toBeNull();

  const after = (await bClient.rpc('my_invitations')).data as any[];
  expect(after.find((r) => r.account_id === accountId)).toBeFalsy();
  const st = await admin.from('account_invitations').select('status').eq('id', row.invitation_id).single();
  expect(st.data!.status).toBe('revoked');
});

t('remove: owner removes a member after accept; the member loses access', async () => {
  const accountId = await seedAccount('Remove-Konto');
  await seedTransactions(accountId, userA);
  await aClient.rpc('invite_to_account', { p_account_id: accountId, p_email: emailB });
  const row = ((await bClient.rpc('my_invitations')).data as any[]).find((r) => r.account_id === accountId);
  await bClient.rpc('respond_to_invitation', { p_invitation_id: row.invitation_id, p_accept: true });
  expect((await bClient.from('accounts').select('id').eq('id', accountId)).data).toHaveLength(1);

  const res = await aClient.rpc('remove_member', { p_account_id: accountId, p_user_id: userB });
  expect(res.error).toBeNull();

  expect((await bClient.from('accounts').select('id').eq('id', accountId)).data ?? []).toHaveLength(0);
  const mem = await admin.from('account_members').select('user_id').eq('account_id', accountId);
  expect(mem.data).toHaveLength(1); // only the owner remains
});

t('leave: a member leaves; they lose access and the owner keeps the account', async () => {
  const accountId = await seedAccount('Leave-Konto');
  await aClient.rpc('invite_to_account', { p_account_id: accountId, p_email: emailB });
  const row = ((await bClient.rpc('my_invitations')).data as any[]).find((r) => r.account_id === accountId);
  await bClient.rpc('respond_to_invitation', { p_invitation_id: row.invitation_id, p_accept: true });

  const res = await bClient.rpc('leave_account', { p_account_id: accountId });
  expect(res.error).toBeNull();

  expect((await bClient.from('accounts').select('id').eq('id', accountId)).data ?? []).toHaveLength(0);
  expect((await aClient.from('accounts').select('id').eq('id', accountId)).data).toHaveLength(1);
});

t('owner cannot leave their own account', async () => {
  const accountId = await seedAccount('Owner-Stays-Konto');
  const res = await aClient.rpc('leave_account', { p_account_id: accountId });
  expect(res.error).not.toBeNull();
  expect((await aClient.from('accounts').select('id').eq('id', accountId)).data).toHaveLength(1);
});

t('duplicate pending invite is blocked: inviting the same person twice yields one pending row', async () => {
  const accountId = await seedAccount('Dup-Konto');
  await aClient.rpc('invite_to_account', { p_account_id: accountId, p_email: emailB });
  const second = await aClient.rpc('invite_to_account', { p_account_id: accountId, p_email: emailB });
  expect(second.error).toBeNull(); // opaque: no error surfaced

  const pend = await admin.from('account_invitations').select('id')
    .eq('account_id', accountId).eq('invitee_id', userB).eq('status', 'pending');
  expect(pend.data).toHaveLength(1);
});

t('a member importing into a shared account: their transaction is visible to all members', async () => {
  const accountId = await seedAccount('Shared-Import-Konto');
  await aClient.rpc('invite_to_account', { p_account_id: accountId, p_email: emailB });
  const row = ((await bClient.rpc('my_invitations')).data as any[]).find((r) => r.account_id === accountId);
  await bClient.rpc('respond_to_invitation', { p_invitation_id: row.invitation_id, p_accept: true });

  // B inserts a transaction tagged with their own user_id (as an import would).
  const ins = await bClient.from('transactions').insert({
    user_id: userB, account_id: accountId, gc_transaction_id: `${accountId}-bimport`,
    booking_date: '2025-07-01', amount_cents: -999, counterparty: 'B-Shop', category: 'Konsum',
  });
  expect(ins.error).toBeNull();

  // The owner (A) sees B's transaction.
  const aSees = await aClient.from('transactions').select('id').eq('account_id', accountId).eq('gc_transaction_id', `${accountId}-bimport`);
  expect(aSees.data).toHaveLength(1);
});
