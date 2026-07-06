// Connect-a-bank flow. Enable Banking's API is stubbed at the browser level
// (page.route on our own /api/banks/* endpoints), so no live credentials are
// needed and nothing leaves the machine.
import { test, expect } from '@playwright/test';
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
// Skip cleanly (rather than erroring) when creds are absent, e.g. in CI.
const t = hasCreds ? test : test.skip;

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost',
  env.SUPABASE_SERVICE_ROLE_KEY ?? 'x',
  { auth: { persistSession: false } },
);

const email = `e2e+connect${Date.now()}@yah-itest.local`;
const password = 'Test-Password-123!';
let userId = '';

const BANKS = {
  banks: [
    { name: 'Mock Bank DE', country: 'DE', logo: null, beta: false },
    { name: 'Testbank Berlin', country: 'DE', logo: null, beta: true },
  ],
};

test.beforeAll(async () => {
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error) throw r.error;
  userId = r.data.user!.id;
});

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId); // cascade clears accounts+txns
});

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('E-Mail').fill(email);
  await page.getByPlaceholder('Passwort').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForURL('**/dashboard');
}

t('first-time user: dashboard link -> picker -> bank consent redirect', async ({ page }) => {
  await page.route('**/api/banks/institutions?*', (route) =>
    route.fulfill({ json: BANKS }));
  let connectBody: any = null;
  await page.route('**/api/banks/connect', async (route) => {
    connectBody = route.request().postDataJSON();
    await route.fulfill({ json: { url: '/login?bank-consent-stub=1' } });
  });

  await login(page);

  // Zero-state dashboard offers the connect path — and it must resolve now.
  await expect(page.getByText('Willkommen')).toBeVisible();
  await page.getByRole('link', { name: 'Bankkonto verbinden' }).click();
  await page.waitForURL('**/connect');
  await expect(page.getByRole('heading', { name: 'Bankkonto verbinden' })).toBeVisible();

  // Both stubbed banks render; the beta one is marked.
  await expect(page.getByRole('button', { name: /Mock Bank DE/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Testbank Berlin \(Beta\)/ })).toBeVisible();

  // Client-side filter narrows the list.
  await page.getByPlaceholder(/Bank suchen/).fill('mock');
  await expect(page.getByRole('button', { name: /Testbank Berlin/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Mock Bank DE/ })).toBeVisible();

  // Clicking a bank POSTs the selection and redirects to the returned URL.
  await page.getByRole('button', { name: /Mock Bank DE/ }).click();
  await page.waitForURL('**/login?bank-consent-stub=1');
  expect(connectBody).toEqual({ name: 'Mock Bank DE', country: 'DE' });
});

t('picker shows an empty state when no banks are available', async ({ page }) => {
  await page.route('**/api/banks/institutions?*', (route) =>
    route.fulfill({ json: { banks: [] } }));
  await login(page);
  await page.goto('/connect');
  await expect(page.getByText('Für dieses Land sind keine Banken verfügbar.')).toBeVisible();
});

t('picker shows an error state with retry when the list fails to load', async ({ page }) => {
  // State-based (not call-count-based) stub: React StrictMode double-runs
  // effects in dev, so the number of fetches per render isn't deterministic.
  let fail = true;
  await page.route('**/api/banks/institutions?*', (route) =>
    fail
      ? route.fulfill({ status: 500, json: { error: 'boom' } })
      : route.fulfill({ json: BANKS }));
  await login(page);
  await page.goto('/connect');
  await expect(page.getByText('Bankenliste konnte nicht geladen werden.')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.getByRole('button', { name: /Mock Bank DE/ })).toBeVisible();
});

t('logged-out user is redirected from /connect to /login', async ({ page }) => {
  await page.goto('/connect');
  await page.waitForURL('**/login');
  await expect(page.getByPlaceholder('E-Mail')).toBeVisible();
});
