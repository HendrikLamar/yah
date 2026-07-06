// Unit tests for the Enable Banking adapter's pure parts: the RS256 JWT
// builder and the response-shape mappers used by sync.
import { describe, it, expect, beforeAll } from 'vitest';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { buildJwt, mapTransaction, mapTransactions, pickBalanceCents } from '../enablebanking';

const b64urlToJson = (s: string) =>
  JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

describe('buildJwt', () => {
  let publicPem: string;

  beforeAll(() => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    publicPem = publicKey;
    process.env.ENABLE_BANKING_APPLICATION_ID = 'test-app-id';
    process.env.ENABLE_BANKING_PRIVATE_KEY_B64 = Buffer.from(privateKey, 'utf8').toString('base64');
  });

  it('produces a three-part token with the expected header', () => {
    const jwt = buildJwt();
    const [h] = jwt.split('.');
    expect(jwt.split('.')).toHaveLength(3);
    expect(b64urlToJson(h)).toEqual({ typ: 'JWT', alg: 'RS256', kid: 'test-app-id' });
  });

  it('sets iss/aud and a lifetime of at most one hour', () => {
    const before = Math.floor(Date.now() / 1000);
    const claims = b64urlToJson(buildJwt().split('.')[1]);
    const after = Math.floor(Date.now() / 1000);
    expect(claims.iss).toBe('enablebanking.com');
    expect(claims.aud).toBe('api.enablebanking.com');
    expect(claims.iat).toBeGreaterThanOrEqual(before);
    expect(claims.iat).toBeLessThanOrEqual(after);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(3600);
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it('signs verifiably with the application private key', () => {
    const jwt = buildJwt();
    const [h, p, sig] = jwt.split('.');
    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${p}`);
    expect(v.verify(publicPem, sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')).toBe(true);
  });
});

describe('mapTransaction', () => {
  const base = {
    entry_reference: 'ref-1',
    transaction_amount: { amount: '42.50', currency: 'EUR' },
    credit_debit_indicator: 'DBIT',
    booking_date: '2026-06-15',
    value_date: '2026-06-16',
    creditor: { name: 'REWE' },
    creditor_account: { iban: 'DE11111111111111111111' },
    remittance_information: ['Einkauf', 'Danke'],
  };
  const none = new Set<string>();

  it('makes DBIT amounts negative cents', () => {
    expect(mapTransaction(base, none)!.amount_cents).toBe(-4250);
  });

  it('makes CRDT amounts positive cents', () => {
    const m = mapTransaction({ ...base, credit_debit_indicator: 'CRDT' }, none)!;
    expect(m.amount_cents).toBe(4250);
  });

  it('keeps the raw sign when the indicator is missing', () => {
    const m = mapTransaction({
      ...base, credit_debit_indicator: undefined,
      transaction_amount: { amount: '-13.37', currency: 'EUR' },
    }, none)!;
    expect(m.amount_cents).toBe(-1337);
  });

  it('does not double-negate an already negative DBIT amount', () => {
    const m = mapTransaction({
      ...base, transaction_amount: { amount: '-42.50', currency: 'EUR' },
    }, none)!;
    expect(m.amount_cents).toBe(-4250);
  });

  it('builds the dedupe id from entry_reference plus a content hash, falling back to transaction_id', () => {
    expect(mapTransaction(base, none)!.external_transaction_id).toMatch(/^ref-1_[a-z0-9]+$/);
    const m = mapTransaction({ ...base, entry_reference: undefined, transaction_id: 'tx-9' }, none)!;
    expect(m.external_transaction_id).toMatch(/^tx-9_[a-z0-9]+$/);
    // stable for identical input
    expect(mapTransaction(base, none)!.external_transaction_id)
      .toBe(mapTransaction({ ...base }, none)!.external_transaction_id);
  });

  it('returns null without any dedupe id or without a booking date', () => {
    expect(mapTransaction({ ...base, entry_reference: undefined }, none)).toBeNull();
    expect(mapTransaction({ ...base, booking_date: undefined }, none)).toBeNull();
  });

  it('joins remittance_information into the purpose', () => {
    expect(mapTransaction(base, none)!.purpose).toBe('Einkauf Danke');
    expect(mapTransaction({ ...base, remittance_information: undefined }, none)!.purpose).toBe('');
  });

  it('takes counterparty and iban from creditor, else debtor', () => {
    const m = mapTransaction(base, none)!;
    expect(m.counterparty).toBe('REWE');
    expect(m.counterparty_iban).toBe('DE11111111111111111111');
    const d = mapTransaction({
      ...base, creditor: undefined, creditor_account: undefined,
      debtor: { name: 'ARBEITGEBER' }, debtor_account: { iban: 'DE22222222222222222222' },
    }, none)!;
    expect(d.counterparty).toBe('ARBEITGEBER');
    expect(d.counterparty_iban).toBe('DE22222222222222222222');
  });

  it('flags internal transfers when the counterparty iban is one of our own', () => {
    const own = new Set(['DE11111111111111111111']);
    expect(mapTransaction(base, own)!.is_internal).toBe(true);
    expect(mapTransaction(base, none)!.is_internal).toBe(false);
  });

  it('falls back value_date -> booking_date and currency -> EUR', () => {
    const m = mapTransaction({
      ...base, value_date: undefined,
      transaction_amount: { amount: '1.00' },
    }, none)!;
    expect(m.value_date).toBe('2026-06-15');
    expect(m.currency).toBe('EUR');
  });
});

// Enable Banking's own synthetic bank data shows entry_reference is a
// scheme-level reference, NOT a transaction identity: one MobilePay reference
// covered 44 distinct payments. The dedupe key must therefore incorporate the
// transaction content, or upsert(ignoreDuplicates) silently drops real rows.
describe('mapTransactions — dedupe keys', () => {
  const none = new Set<string>();
  // Shapes taken from Enable Banking's DK-Danske_Bank synthetic dataset:
  // shared entry_reference, null creditor/debtor, string amounts.
  const mobilePay = (amount: string, date: string, who: string) => ({
    entry_reference: '3845245274',
    transaction_amount: { currency: 'DKK', amount },
    creditor: null, creditor_account: null, debtor: null, debtor_account: null,
    credit_debit_indicator: 'CRDT', status: 'BOOK',
    booking_date: date, value_date: date,
    remittance_information: [`MobilePay: ${who}`],
  });

  it('gives distinct keys to different transactions sharing an entry_reference', () => {
    const out = mapTransactions([
      mobilePay('200.0', '2020-09-24', 'Emma Nielsen'),
      mobilePay('24.0', '2020-09-25', 'Christina Nielsen'),
      mobilePay('4.0', '2020-09-25', 'Clara Mepris'),
    ], none);
    expect(out).toHaveLength(3);
    expect(new Set(out.map((m) => m.external_transaction_id)).size).toBe(3);
  });

  it('gives distinct, order-independent keys to fully identical rows', () => {
    const twin = () => mobilePay('10.0', '2020-09-25', 'Emma Nielsen');
    const a = mapTransactions([twin(), twin()], none);
    const b = mapTransactions([twin(), twin()].reverse(), none);
    expect(a).toHaveLength(2);
    expect(new Set(a.map((m) => m.external_transaction_id)).size).toBe(2);
    // same key SET regardless of the order the API returned them in
    expect(new Set(a.map((m) => m.external_transaction_id)))
      .toEqual(new Set(b.map((m) => m.external_transaction_id)));
  });

  it('is idempotent: re-mapping the same batch yields the same keys', () => {
    const batch = [
      mobilePay('200.0', '2020-09-24', 'Emma Nielsen'),
      mobilePay('200.0', '2020-09-24', 'Emma Nielsen'),
      mobilePay('4.0', '2020-09-25', 'Clara Mepris'),
    ];
    const a = mapTransactions(batch, none).map((m) => m.external_transaction_id).sort();
    const b = mapTransactions(batch, none).map((m) => m.external_transaction_id).sort();
    expect(a).toEqual(b);
  });

  it('drops unmappable rows but keeps the rest', () => {
    const out = mapTransactions([
      mobilePay('200.0', '2020-09-24', 'Emma Nielsen'),
      { ...mobilePay('1.0', '2020-09-24', 'X'), entry_reference: undefined },
    ], none);
    expect(out).toHaveLength(1);
  });

  it('maps the all-null-counterparty shape from real bank data', () => {
    const [m] = mapTransactions([mobilePay('200.0', '2020-09-24', 'Emma Nielsen')], none);
    expect(m.amount_cents).toBe(20000);
    expect(m.currency).toBe('DKK');
    expect(m.counterparty).toBe('');
    expect(m.counterparty_iban).toBeNull();
    expect(m.purpose).toBe('MobilePay: Emma Nielsen');
  });
});

describe('pickBalanceCents', () => {
  const bal = (type: string, amount: string) => ({ balance_type: type, balance_amount: { amount } });

  it('prefers CLBD, then ITAV, then ITBD, then XPCD, else the first entry', () => {
    expect(pickBalanceCents([bal('XPCD', '3.00'), bal('CLBD', '1.00'), bal('ITAV', '2.00')])).toBe(100);
    expect(pickBalanceCents([bal('XPCD', '3.00'), bal('ITAV', '2.00')])).toBe(200);
    // shape seen in Enable Banking's synthetic bank data: ITAV/ITBD/OTHR
    expect(pickBalanceCents([bal('ITAV', '2.00'), bal('ITBD', '4.00'), bal('OTHR', '9.99')])).toBe(200);
    expect(pickBalanceCents([bal('ITBD', '4.00'), bal('XPCD', '3.00')])).toBe(400);
    expect(pickBalanceCents([bal('OTHR', '9.99'), bal('XPCD', '3.00')])).toBe(300);
    expect(pickBalanceCents([bal('OTHR', '9.99')])).toBe(999);
  });

  it('parses decimal strings to integer cents', () => {
    expect(pickBalanceCents([bal('CLBD', '1234.56')])).toBe(123456);
    expect(pickBalanceCents([bal('CLBD', '-0.01')])).toBe(-1);
  });

  it('returns null for an empty or unusable list', () => {
    expect(pickBalanceCents([])).toBeNull();
    expect(pickBalanceCents(undefined as any)).toBeNull();
    expect(pickBalanceCents([{ balance_type: 'CLBD' }])).toBeNull();
  });
});
