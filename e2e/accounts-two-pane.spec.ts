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
const emailA = `e2e-2pane-owner+${stamp}@yah-itest.local`;
const emailB = `e2e-2pane-member+${stamp}@yah-itest.local`;
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
async function seedAccount(name: string, balanceCents: number): Promise<string> {
  const iban = `DE${String(10 ** 19 + ibanSeq++).slice(0, 20)}`;
  const { data, error } = await admin.from('accounts').insert({
    user_id: userA, name, account_type: 'giro', iban, balance_cents: balanceCents,
  }).select('id').single();
  if (error) throw error;
  return data!.id as string;
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

async function shareWith(accountId: string, member: SupabaseClient) {
  await aClient.rpc('invite_to_account', { p_account_id: accountId, p_email: emailB });
  const row = ((await member.rpc('my_invitations')).data as any[]).find((r) => r.account_id === accountId);
  await member.rpc('respond_to_invitation', { p_invitation_id: row.invitation_id, p_accept: true });
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

t('selecting another account in the list updates the detail pane', async ({ page }) => {
  await seedAccount('Erstes-Konto', 123400);
  await seedAccount('Zweites-Konto', 567800);

  await loginUI(page, emailA);
  await page.goto('/accounts');

  // First account is preselected; its name + balance show in the detail header.
  await expect(page.locator('.ap-detail strong')).toHaveText('Erstes-Konto');
  await expect(page.locator('.ap-detail').getByText('1.234,00 €')).toBeVisible();

  await selectAccount(page, 'Zweites-Konto');
  await expect(page.locator('.ap-detail strong')).toHaveText('Zweites-Konto');
  await expect(page.locator('.ap-detail').getByText('5.678,00 €')).toBeVisible();
});

t('back-to-dashboard button navigates to /dashboard', async ({ page }) => {
  await seedAccount('Nav-Konto', 100000);
  await loginUI(page, emailA);
  await page.goto('/accounts');
  await page.getByRole('link', { name: '← Zurück zum Dashboard' }).click();
  await page.waitForURL('**/dashboard');
});

t('owner: "Zugriff entziehen" needs inline confirmation; cancel keeps the member, confirm removes them', async ({ page }) => {
  const accountId = await seedAccount('Entzug-Konto', 200000);
  await shareWith(accountId, bClient);
  expect((await admin.from('account_members').select('user_id').eq('account_id', accountId)).data).toHaveLength(2);

  await loginUI(page, emailA);
  await page.goto('/accounts');
  await selectAccount(page, 'Entzug-Konto');

  const detail = page.locator('.ap-detail');
  await expect(detail.getByText(emailB)).toBeVisible();

  // First click reveals the inline confirmation.
  await detail.getByRole('button', { name: 'Zugriff entziehen' }).click();
  await expect(detail.getByRole('button', { name: 'Wirklich entziehen?' })).toBeVisible();

  // Cancel keeps the member.
  await detail.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(detail.getByRole('button', { name: 'Zugriff entziehen' })).toBeVisible();
  expect((await admin.from('account_members').select('user_id').eq('account_id', accountId)).data).toHaveLength(2);

  // Confirm removes the member.
  await detail.getByRole('button', { name: 'Zugriff entziehen' }).click();
  await detail.getByRole('button', { name: 'Wirklich entziehen?' }).click();
  await expect(detail.getByText(emailB)).toHaveCount(0);
  await expect.poll(async () =>
    (await admin.from('account_members').select('user_id').eq('account_id', accountId)).data?.length,
  ).toBe(1);
});

t('member: "Konto verlassen" with inline confirmation removes own access', async ({ page }) => {
  const accountId = await seedAccount('Verlassen-Konto', 300000);
  await shareWith(accountId, bClient);

  await loginUI(page, emailB);
  await page.goto('/accounts');
  await selectAccount(page, 'Verlassen-Konto');

  const detail = page.locator('.ap-detail');
  await detail.getByRole('button', { name: 'Konto verlassen' }).click();
  await detail.getByRole('button', { name: 'Wirklich verlassen?' }).click();

  await expect.poll(async () =>
    (await admin.from('account_members').select('user_id').eq('account_id', accountId)).data?.length,
  ).toBe(1);
  expect((await bClient.from('accounts').select('id').eq('id', accountId)).data ?? []).toHaveLength(0);
});
