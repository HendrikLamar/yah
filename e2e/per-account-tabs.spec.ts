import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=([^#]*)/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const hasCreds = !!(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
const t = hasCreds ? test : test.skip;

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost',
  env.SUPABASE_SERVICE_ROLE_KEY ?? 'x',
  { auth: { persistSession: false } },
);

const email = `e2e+tabs${Date.now()}@yah-itest.local`;
const coEmail = `e2e+tabsco${Date.now()}@yah-itest.local`;
const password = 'Test-Password-123!';
let userId = '';
let coUserId = '';

type AcctOpts = { name: string; account_type?: 'giro' | 'savings' | 'joint'; is_joint?: boolean; balance_cents?: number };
async function seedAccount(o: AcctOpts): Promise<string> {
  const { data, error } = await admin.from('accounts').insert({
    user_id: userId, name: o.name, account_type: o.account_type ?? 'giro',
    is_joint: o.is_joint ?? false, balance_cents: o.balance_cents ?? 100000,
  }).select('id').single();
  if (error) throw error;
  return data!.id as string;
}
type TxRow = { d: string; cents: number; cat: string; cp?: string };
async function seedTx(accountId: string, rows: TxRow[]) {
  const { error } = await admin.from('transactions').insert(rows.map((r) => ({
    user_id: userId, account_id: accountId, booking_date: r.d, amount_cents: r.cents,
    category: r.cat, counterparty: r.cp ?? '', purpose: '',
  })));
  if (error) throw error;
}

async function clearAccounts() {
  await admin.from('accounts').delete().eq('user_id', userId); // cascade clears transactions
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('E-Mail').fill(email);
  await page.getByPlaceholder('Passwort').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard');
}

test.beforeAll(async () => {
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error) throw r.error;
  userId = r.data.user!.id;
  // A co-member used to make an account genuinely shared (member_count > 1).
  const co = await admin.auth.admin.createUser({ email: coEmail, password, email_confirm: true });
  if (co.error) throw co.error;
  coUserId = co.data.user!.id;
});

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (coUserId) await admin.auth.admin.deleteUser(coUserId);
});

// Add a second member so member_count > 1 — the dashboard derives the shared
// badge from membership count (not is_joint), per the account-sharing model.
async function addCoMember(accountId: string) {
  const { error } = await admin.from('account_members')
    .insert({ account_id: accountId, user_id: coUserId, role: 'member' });
  if (error) throw error;
}

test.beforeEach(async () => {
  await clearAccounts();
});

t('single account with data renders exactly one tab and no consolidated tab', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const giro = await seedAccount({ name: 'Girokonto', account_type: 'giro' });
  await seedTx(giro, [
    { d: '2025-01-31', cents: 314625, cat: 'Einnahmen · Gehalt' },
    { d: '2025-01-15', cents: -4250, cat: 'Lebensmittel & Drogerie', cp: 'REWE' },
    { d: '2025-03-04', cents: -54032, cat: 'Kreditkarte (AMEX)' },
  ]);

  await login(page);
  await expect(page.getByText('Finanzanalyse')).toBeVisible();
  await expect(page.locator('.tabbtn')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Haushalt gesamt/ })).toHaveCount(0);
  await expect(page.locator('.tabbtn').first()).toContainText('Girokonto');
  // crash-regression guard: the old view threw on empty/edge data
  expect(errors).toEqual([]);
});

t('account with transactions but no categorised expenses shows empty state, no crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const giro = await seedAccount({ name: 'Nur Einnahmen', account_type: 'giro' });
  await seedTx(giro, [
    { d: '2025-02-01', cents: 200000, cat: 'Einnahmen · Gehalt' },
  ]);

  await login(page);
  await expect(page.locator('.tabbtn')).toHaveCount(1);
  await expect(page.getByText('Keine kategorisierten Ausgaben.').first()).toBeVisible();
  expect(errors).toEqual([]);
});

t('two accounts render a tab each plus a consolidated household tab', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const giro = await seedAccount({ name: 'Girokonto', account_type: 'giro' });
  const joint = await seedAccount({ name: 'Gemeinschaftskonto', account_type: 'joint', is_joint: true });
  await addCoMember(joint); // genuinely shared → member_count > 1
  await seedTx(giro, [
    { d: '2025-01-31', cents: 300000, cat: 'Einnahmen · Gehalt' },
    { d: '2025-01-15', cents: -4250, cat: 'Lebensmittel & Drogerie', cp: 'REWE' },
  ]);
  await seedTx(joint, [
    { d: '2025-01-03', cents: 60000, cat: 'Einzahlung · Sina' },
    { d: '2025-01-05', cents: -120000, cat: 'Miete' },
  ]);

  await login(page);
  await expect(page.locator('.tabbtn')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Haushalt gesamt/ })).toBeVisible();

  // the shared account tab shows a shared badge; the private giro tab does not
  await page.getByRole('button', { name: /Gemeinschaftskonto/ }).click();
  await expect(page.locator('.tabpanel.show .shared-badge')).toBeVisible();
  await page.getByRole('button', { name: /Girokonto/ }).click();
  await expect(page.locator('.tabpanel.show .shared-badge')).toHaveCount(0);

  expect(errors).toEqual([]);
});

t('renaming an account in /accounts updates the dashboard tab label', async ({ page }) => {
  const giro = await seedAccount({ name: 'Girokonto', account_type: 'giro' });
  await seedTx(giro, [{ d: '2025-01-15', cents: -4250, cat: 'Lebensmittel & Drogerie', cp: 'REWE' }]);

  await login(page);
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { name: 'Konten verwalten' })).toBeVisible();
  const input = page.getByLabel('Anzeigename für Girokonto');
  await input.fill('Mein Hauptkonto');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('gespeichert')).toBeVisible();

  await page.goto('/dashboard');
  await expect(page.locator('.tabbtn').first()).toContainText('Mein Hauptkonto');
});

t('profile dropdown shows the email and logs out to /login', async ({ page }) => {
  const giro = await seedAccount({ name: 'Girokonto', account_type: 'giro' });
  await seedTx(giro, [{ d: '2025-01-15', cents: -4250, cat: 'Lebensmittel & Drogerie', cp: 'REWE' }]);

  await login(page);
  await page.getByRole('button', { name: 'Profilmenü' }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await page.waitForURL('**/login');
  await expect(page.getByPlaceholder('E-Mail')).toBeVisible();
});
