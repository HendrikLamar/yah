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

const email = `e2e+${Date.now()}@yah-itest.local`;
const password = 'Test-Password-123!';
let userId = '';

const GIRO_IBAN = 'DE30120300001030293144';
const TAGES_IBAN = 'DE62120300001021068935';
const CSV = [
  '"Umsatzliste";""',
  '"Kontoinhaber:";"Hendrik Windel"',
  `"IBAN:";"${GIRO_IBAN}"`,
  '"Kontostand vom 31.12.2025:";"5.000,00 EUR"',
  '""',
  '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"',
  '"15.06.2025";"15.06.2025";"Gebucht";"Hendrik Windel";"REWE SAGT DANKE";"Einkauf";"Ausgang";"";"-42,50";"";"";""',
  '"28.06.2025";"28.06.2025";"Gebucht";"ARBEITGEBER GMBH";"Hendrik Windel";"Gehalt Juni";"Eingang";"";"3.000,00";"";"";""',
  `"01.06.2025";"01.06.2025";"Gebucht";"Hendrik Windel";"Eigenuebertrag";"Umbuchung Tagesgeld";"Ausgang";"${TAGES_IBAN}";"-500,00";"";"";""`,
  '"03.06.2025";"03.06.2025";"Gebucht";"Hendrik Windel";"Vermieter Mustermann";"Miete Juni";"Ausgang";"";"-1.200,00";"";"";""',
].join('\n');

test.beforeAll(async () => {
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error) throw r.error;
  userId = r.data.user!.id;
});

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId); // cascade clears accounts+txns
});

t('full UI: login -> import CSV -> dashboard renders', async ({ page }) => {
  // 1) Login through the real form
  await page.goto('/login');
  await page.getByPlaceholder('E-Mail').fill(email);
  await page.getByPlaceholder('Passwort').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();

  // 2) Lands on the empty dashboard (no accounts yet)
  await page.waitForURL('**/dashboard');
  await expect(page.getByText('Willkommen')).toBeVisible();

  // 3) Go to import
  await page.getByRole('link', { name: 'CSV importieren' }).click();
  await page.waitForURL('**/import');
  await expect(page.getByRole('heading', { name: /CSV-Import/ })).toBeVisible();

  // 4) Upload the CSV into a new giro account and submit
  await page.locator('input[type=file]').setInputFiles({
    name: 'dkb.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8'),
  });
  await page.locator('input[name=name]').fill('Girokonto');
  // account_type already defaults to "giro"
  await page.getByRole('button', { name: 'Importieren' }).click();

  // 5) Server action redirects back to the dashboard, now populated
  await page.waitForURL('**/dashboard');
  await expect(page.getByText('Finanzanalyse')).toBeVisible();
  // one tab per imported account; the CSV created a single "Girokonto"
  await expect(page.locator('.tabbtn')).toHaveCount(1);
  await expect(page.locator('.tabbtn').first()).toContainText('Girokonto');

  // 6) Verify rows actually persisted for this user
  const { count } = await admin
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  expect(count).toBe(4);
});

t('logged-out user is redirected from protected routes to /login', async ({ page }) => {
  await page.goto('/import');
  await page.waitForURL('**/login');
  await expect(page.getByPlaceholder('E-Mail')).toBeVisible();
});
