import { describe, it, expect } from 'vitest';
import { buildImportRows, contentHash } from '../import-dkb';
import type { DkbRow } from '../dkb-csv';

const GIRO_IBAN = 'DE30120300001030293144';
const TAGES_IBAN = 'DE62120300001021068935';

const row = (o: Partial<DkbRow>): DkbRow => ({
  bookingDate: '2025-01-15', payer: '', counterparty: '', purpose: '',
  type: 'Ausgang', amountCents: -1000, counterpartyIban: null, ...o,
});

describe('contentHash', () => {
  it('is deterministic for identical content', () => {
    const r = row({ counterparty: 'REWE', amountCents: -4250 });
    expect(contentHash(r)).toBe(contentHash({ ...r }));
  });
  it('differs when any field changes', () => {
    const a = contentHash(row({ counterparty: 'REWE', amountCents: -4250 }));
    const b = contentHash(row({ counterparty: 'REWE', amountCents: -4251 }));
    expect(a).not.toBe(b);
  });
});

describe('buildImportRows — dedup keys', () => {
  const ownIbans = new Set<string>();
  const dup = () => row({ counterparty: 'Vermieter', purpose: 'Miete', amountCents: -50000, counterpartyIban: null });
  it('gives two identical same-day rows in one batch distinct dedup keys', () => {
    const out = buildImportRows({ rows: [dup(), dup()], accountRole: 'giro', ownIbans });
    expect(out[0].gc_transaction_id).not.toBe(out[1].gc_transaction_id);
  });
  it('is idempotent: re-importing the same batch yields the same keys', () => {
    const a = buildImportRows({ rows: [dup(), dup()], accountRole: 'giro', ownIbans });
    const b = buildImportRows({ rows: [dup(), dup()], accountRole: 'giro', ownIbans });
    expect(a.map((r) => r.gc_transaction_id)).toEqual(b.map((r) => r.gc_transaction_id));
  });
});

describe('buildImportRows — giro', () => {
  const ownIbans = new Set([TAGES_IBAN]);
  it('classifies a normal personal expense', () => {
    const [r] = buildImportRows({
      rows: [row({ counterparty: 'REWE SAGT DANKE', purpose: 'Einkauf', amountCents: -4250 })],
      accountRole: 'giro', ownIbans,
    });
    expect(r.category).toBe('Lebensmittel & Drogerie');
    expect(r.category_group).toBe('Konsum');
    expect(r.is_internal).toBe(false);
    expect(r.amount_cents).toBe(-4250);
    expect(r.gc_transaction_id).toBeTruthy();
  });
  it('flags an internal transfer to another own account', () => {
    const [r] = buildImportRows({
      rows: [row({ purpose: 'Umbuchung', amountCents: -50000, counterpartyIban: TAGES_IBAN })],
      accountRole: 'giro', ownIbans,
    });
    expect(r.is_internal).toBe(true);
    expect(r.category).toBe('Interner Transfer (Tagesgeld)');
  });
  it('applies user rules before the default engine', () => {
    const [r] = buildImportRows({
      rows: [row({ counterparty: 'REWE SAGT DANKE', amountCents: -4250 })],
      accountRole: 'giro', ownIbans,
      rules: [{ match_field: 'counterparty', pattern: 'rewe', category: 'Mein Supermarkt', priority: 1 }],
    });
    expect(r.category).toBe('Mein Supermarkt');
  });
});

describe('buildImportRows — savings', () => {
  const ownIbans = new Set([GIRO_IBAN]);
  it('classifies interest by kind', () => {
    const [r] = buildImportRows({
      rows: [row({ counterparty: 'DKB AG', purpose: 'Zinsen', amountCents: 523, type: 'Eingang' })],
      accountRole: 'savings', ownIbans,
    });
    expect(r.category).toBe('Einnahmen · Zinsen');
    expect(r.category_group).toBe('Einnahmen');
  });
  it('classifies an internal inflow as a Tagesgeld deposit', () => {
    const [r] = buildImportRows({
      rows: [row({ amountCents: 50000, type: 'Eingang', counterpartyIban: GIRO_IBAN })],
      accountRole: 'savings', ownIbans,
    });
    expect(r.category).toBe('Sparen (Tagesgeld-Einzahlung)');
    expect(r.is_internal).toBe(true);
  });
});

describe('buildImportRows — joint', () => {
  const ownIbans = new Set([GIRO_IBAN, TAGES_IBAN]);
  it('attributes a partner inflow using the partner name', () => {
    const [r] = buildImportRows({
      rows: [row({ payer: 'Sina Unseld', amountCents: 60000, type: 'Eingang' })],
      accountRole: 'joint', ownIbans, partnerName: 'Sina',
    });
    expect(r.category).toBe('Einzahlung · Sina');
  });
  it('attributes an own-account inflow to Hendrik', () => {
    const [r] = buildImportRows({
      rows: [row({ amountCents: 80000, type: 'Eingang', counterpartyIban: GIRO_IBAN })],
      accountRole: 'joint', ownIbans, partnerName: 'Sina',
    });
    expect(r.category).toBe('Einzahlung · Hendrik');
  });
  it('detects rent on the joint account', () => {
    const [r] = buildImportRows({
      rows: [row({ counterparty: 'Katharina Katz', amountCents: -120000 })],
      accountRole: 'joint', ownIbans, partnerName: 'Sina',
    });
    expect(r.category).toBe('Miete');
  });
});
