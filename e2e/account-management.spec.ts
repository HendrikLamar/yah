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
const emailA = `e2e-mgmt-owner+${stamp}@yah-itest.local`;
const emailB = `e2e-mgmt-member+${stamp}@yah-itest.local`;
const emailC = `e2e-mgmt-solo+${stamp}@yah-itest.local`;
let userA = '';
let userB = '';
let userC = '';
let aClient: SupabaseClient;
let bClient: SupabaseClient;

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

let ibanSeq = 0;
async function seedAccount(name: string, ownerId: string, connectionId?: string): Promise<string> {
  const iban = `DE${String(10 ** 19 + ibanSeq++).slice(0, 20)}`;
  const { data, error } = await admin.from('accounts').insert({
    user_id: ownerId, name, account_type: 'giro', iban, balance_cents: 123400,
    ...(connectionId ? { connection_id: connectionId } : {}),
  }).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

async function seedTransactions(accountId: string, userId: string): Promise<number> {
  const rows = [
    { user_id: userId, account_id: accountId, external_transaction_id: `${accountId}-1`,
      booking_date: '2025-06-15', amount_cents: -4250, counterparty: 'REWE SAGT DANKE',
      purpose: 'Einkauf', category: 'Lebensmittel & Drogerie', category_group: 'Konsum' },
    { user_id: userId, account_id: accountId, external_transaction_id: `${accountId}-2`,
      booking_date: '2025-06-28', amount_cents: 300000, counterparty: 'ARBEITGEBER GMBH',
      purpose: 'Gehalt Juni', category: 'Einnahmen · Gehalt', category_group: 'Einnahmen' },
    { user_id: userId, account_id: accountId, external_transaction_id: `${accountId}-3`,
      booking_date: '2025-06-03', amount_cents: -120000, counterparty: 'Vermieter',
      purpose: 'Miete Juni', category: 'Miete', category_group: 'Konsum' },
  ];
  const { error } = await admin.from('transactions').insert(rows);
  if (error) throw error;
  return rows.length;
}

async function seedConnection(ownerId: string, bankName: string): Promise<string> {
  const { data, error } = await admin.from('bank_connections').insert({
    user_id: ownerId, institution_id: bankName, institution_name: bankName,
    status: 'linked', consent_expires_at: new Date(stamp + 80 * 86400_000).toISOString(),
  }).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

async function shareWithB(accountId: string) {
  const inv = await aClient.rpc('invite_to_account', { p_account_id: accountId, p_email: emailB });
  if (inv.error) throw inv.error;
  const rows = (await bClient.rpc('my_invitations')).data as any[];
  const row = rows.find((r) => r.account_id === accountId);
  const res = await bClient.rpc('respond_to_invitation', { p_invitation_id: row.invitation_id, p_accept: true });
  if (res.error) throw res.error;
}

async function loginUI(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByPlaceholder('E-Mail').fill(email);
  await page.getByPlaceholder('Passwort').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard');
}

async function selectAccount(page: import('@playwright/test').Page, name: string) {
  await page.locator('.ap-item', { hasText: name }).click();
}

test.beforeAll(async () => {
  if (!hasCreds) return;
  for (const [email, set] of [
    [emailA, (id: string) => { userA = id; }],
    [emailB, (id: string) => { userB = id; }],
    [emailC, (id: string) => { userC = id; }],
  ] as const) {
    const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (r.error) throw r.error;
    set(r.data.user!.id);
  }
  aClient = await signIn(emailA);
  bClient = await signIn(emailB);
});

test.afterAll(async () => {
  // Users cascade to accounts/members/transactions; connections cascade via user FK.
  for (const id of [userA, userB, userC]) if (id) await admin.auth.admin.deleteUser(id);
});

t('owner deletes an account: modal shows the transaction count; account and transactions are gone', async ({ page }) => {
  const accountId = await seedAccount('Del-Konto', userA);
  const txCount = await seedTransactions(accountId, userA);

  await loginUI(page, emailA);
  await page.goto('/accounts');
  await selectAccount(page, 'Del-Konto');
  await page.getByRole('button', { name: 'Konto löschen' }).click();
  await expect(page.getByText(`${txCount} Buchungen`)).toBeVisible();
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();

  // Only account at this point — the list collapses to the empty state
  // (also proves the dangling master-detail selection resets cleanly).
  await expect(page.getByText('Noch keine Konten.')).toBeVisible();

  const acc = await admin.from('accounts').select('id').eq('id', accountId);
  expect(acc.data ?? []).toHaveLength(0);
  const tx = await admin.from('transactions').select('*', { count: 'exact', head: true }).eq('account_id', accountId);
  expect(tx.count ?? 0).toBe(0);
});

t('non-owner member sees no delete button and no Gefahrenzone on a shared account', async ({ page }) => {
  const accountId = await seedAccount('Shared-Del-Konto', userA);
  await shareWithB(accountId);

  await loginUI(page, emailB);
  await page.goto('/accounts');
  await selectAccount(page, 'Shared-Del-Konto');
  await expect(page.getByLabel('Anzeigename für Shared-Del-Konto')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Konto löschen' })).toHaveCount(0);
});

t('deleting a shared account warns that all members are affected; cancel keeps it', async ({ page }) => {
  const accountId = await seedAccount('Warn-Konto', userA);
  await shareWithB(accountId);

  await loginUI(page, emailA);
  await page.goto('/accounts');
  await selectAccount(page, 'Warn-Konto');
  await page.getByRole('button', { name: 'Konto löschen' }).click();
  await expect(page.getByText('alle Mitglieder')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toHaveCount(0);

  const acc = await admin.from('accounts').select('id').eq('id', accountId);
  expect(acc.data).toHaveLength(1);
});

t('hide is per member: A hides a shared account — gone from A dashboard, B still sees it; unhide restores', async ({ page, browser }) => {
  const accountId = await seedAccount('Hide-Konto', userA);
  await seedTransactions(accountId, userA);
  await shareWithB(accountId);

  await loginUI(page, emailA);
  await page.goto('/accounts');
  await selectAccount(page, 'Hide-Konto');
  await page.getByRole('button', { name: 'Ausblenden' }).click();
  await expect(page.getByText('ausgeblendet').first()).toBeVisible();

  // Hidden flag set on A's membership row only.
  await expect.poll(async () => {
    const r = await admin.from('account_members').select('user_id, hidden').eq('account_id', accountId);
    return Object.fromEntries((r.data ?? []).map((m) => [m.user_id, m.hidden]));
  }).toEqual({ [userA]: true, [userB]: false });

  // A's dashboard no longer shows the account tab.
  await page.goto('/dashboard');
  await expect(page.locator('.tabbtn', { hasText: 'Hide-Konto' })).toHaveCount(0);

  // B's dashboard still shows it.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await loginUI(pageB, emailB);
  await expect(pageB.locator('.tabbtn', { hasText: 'Hide-Konto' }).first()).toBeVisible();
  await ctxB.close();

  // Accounts page still lists it for A; unhide restores the dashboard tab.
  await page.goto('/accounts');
  await selectAccount(page, 'Hide-Konto');
  await page.getByRole('button', { name: 'Einblenden' }).click();
  await expect.poll(async () => {
    const r = await admin.from('account_members').select('hidden')
      .eq('account_id', accountId).eq('user_id', userA).single();
    return r.data?.hidden;
  }).toBe(false);
  await page.goto('/dashboard');
  await expect(page.locator('.tabbtn', { hasText: 'Hide-Konto' }).first()).toBeVisible();
});

t('all accounts hidden: dashboard shows the all-hidden hint, not the first-time zero state', async ({ page }) => {
  const accountId = await seedAccount('Solo-Konto', userC);
  await seedTransactions(accountId, userC);

  await loginUI(page, emailC);
  await page.goto('/accounts');
  await selectAccount(page, 'Solo-Konto');
  await page.getByRole('button', { name: 'Ausblenden' }).click();
  await expect(page.getByText('ausgeblendet').first()).toBeVisible();

  await page.goto('/dashboard');
  await expect(page.getByText('Alle Konten sind ausgeblendet')).toBeVisible();
  await expect(page.getByText('Noch keine Konten verbunden.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Konten verwalten' })).toBeVisible();
});

t('deleting a connection removes its accounts, their transactions, and the connection row', async ({ page }) => {
  const connId = await seedConnection(userA, 'Testbank Alpha');
  const accountId = await seedAccount('Conn-Konto', userA, connId);
  await seedTransactions(accountId, userA);

  await loginUI(page, emailA);
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Bankverbindungen' })).toBeVisible();
  await expect(page.getByText('Testbank Alpha')).toBeVisible();
  await page.getByRole('button', { name: 'Verbindung Testbank Alpha löschen' }).click();
  // The modal lists the affected account by name.
  await expect(page.getByText('Conn-Konto').last()).toBeVisible();
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByText('Testbank Alpha')).toHaveCount(0);

  const conn = await admin.from('bank_connections').select('id').eq('id', connId);
  expect(conn.data ?? []).toHaveLength(0);
  const acc = await admin.from('accounts').select('id').eq('id', accountId);
  expect(acc.data ?? []).toHaveLength(0);
  const tx = await admin.from('transactions').select('*', { count: 'exact', head: true }).eq('account_id', accountId);
  expect(tx.count ?? 0).toBe(0);
});

t('orphan cleanup: deleting the last account of a connection removes the connection too', async ({ page }) => {
  const connId = await seedConnection(userA, 'Testbank Beta');
  const accountId = await seedAccount('Orphan-Konto', userA, connId);

  await loginUI(page, emailA);
  await page.goto('/accounts');
  await selectAccount(page, 'Orphan-Konto');
  await page.getByRole('button', { name: 'Konto löschen' }).click();
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.locator('.ap-item', { hasText: 'Orphan-Konto' })).toHaveCount(0);

  await expect.poll(async () => {
    const r = await admin.from('bank_connections').select('id').eq('id', connId);
    return (r.data ?? []).length;
  }).toBe(0);
  const acc = await admin.from('accounts').select('id').eq('id', accountId);
  expect(acc.data ?? []).toHaveLength(0);
});

t('a connection with zero accounts (prod debris shape) can be deleted directly', async ({ page }) => {
  const connId = await seedConnection(userA, 'Testbank Leer');

  await loginUI(page, emailA);
  await page.goto('/accounts');
  await expect(page.getByText('Testbank Leer')).toBeVisible();
  await page.getByRole('button', { name: 'Verbindung Testbank Leer löschen' }).click();
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByText('Testbank Leer')).toHaveCount(0);

  const conn = await admin.from('bank_connections').select('id').eq('id', connId);
  expect(conn.data ?? []).toHaveLength(0);
});
