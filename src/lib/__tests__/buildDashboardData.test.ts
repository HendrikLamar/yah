import { describe, it, expect } from 'vitest';
import { buildDashboardData } from '../buildDashboardData';
import type { Account, Transaction } from '../types';

const GIRO_IBAN = 'DE30120300001030293144';
const TAGES_IBAN = 'DE62120300001021068935';
const JOINT_IBAN = 'DE55120300001064640491';

const accounts: Account[] = [
  { id: 'g', iban: GIRO_IBAN, name: 'Girokonto', account_type: 'giro', is_joint: false, balance_cents: 190908, owner_label: 'Hendrik' },
  { id: 't', iban: TAGES_IBAN, name: 'Tagesgeldkonto', account_type: 'savings', is_joint: false, balance_cents: 290522, owner_label: 'Hendrik' },
  { id: 'j', iban: JOINT_IBAN, name: 'Gemeinschaftskonto', account_type: 'joint', is_joint: true, balance_cents: 213790, owner_label: 'Hendrik' },
];

let seq = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${seq++}`, account_id: 'g', booking_date: '2025-01-15', amount_cents: 0,
  counterparty: '', purpose: '', counterparty_iban: null,
  category: 'Shopping & Sonstiges', category_group: 'Konsum', is_internal: false, ...o,
});

const txns: Transaction[] = [
  // giro
  tx({ booking_date: '2025-01-31', amount_cents: 314625, category: 'Einnahmen · Gehalt', category_group: 'Einnahmen' }),
  tx({ booking_date: '2025-02-10', amount_cents: 20912, category: 'Einnahmen · Erstattungen', category_group: 'Einnahmen' }),
  tx({ booking_date: '2025-01-15', amount_cents: -4250, counterparty: 'REWE', category: 'Lebensmittel & Drogerie', category_group: 'Konsum' }),
  tx({ booking_date: '2025-03-04', amount_cents: -54032, counterparty: 'American Express', category: 'Kreditkarte (AMEX)', category_group: 'Konsum' }),
  tx({ booking_date: '2025-01-20', amount_cents: -50000, category: 'Sparen & Investitionen', category_group: 'Vermögen' }),
  tx({ booking_date: '2025-04-09', amount_cents: 100000, category: 'Anlage-Auszahlung (Scalable)', category_group: 'Entsparen' }),
  tx({ booking_date: '2025-02-05', amount_cents: -50000, category: 'Interner Transfer (Tagesgeld)', category_group: 'Intern', counterparty_iban: TAGES_IBAN, is_internal: true }),
  tx({ booking_date: '2025-05-05', amount_cents: 30000, category: 'Interner Transfer (Tagesgeld)', category_group: 'Intern', counterparty_iban: TAGES_IBAN, is_internal: true }),
  // tages
  tx({ account_id: 't', booking_date: '2025-06-30', amount_cents: 523, category: 'Einnahmen · Zinsen', category_group: 'Einnahmen' }),
  tx({ account_id: 't', booking_date: '2025-02-05', amount_cents: 50000, category: 'Sparen (Tagesgeld-Einzahlung)', category_group: 'Vermögen', is_internal: true }),
  tx({ account_id: 't', booking_date: '2025-05-05', amount_cents: -30000, category: 'Entsparen (Tagesgeld-Auszahlung)', category_group: 'Entsparen', is_internal: true }),
  // joint
  tx({ account_id: 'j', booking_date: '2025-01-02', amount_cents: 80000, category: 'Einzahlung · Hendrik', category_group: 'Einnahmen', counterparty_iban: GIRO_IBAN }),
  tx({ account_id: 'j', booking_date: '2025-01-03', amount_cents: 60000, category: 'Einzahlung · Sina', category_group: 'Einnahmen' }),
  tx({ account_id: 'j', booking_date: '2025-02-03', amount_cents: 5000, category: 'Erstattung / extern', category_group: 'Einnahmen' }),
  tx({ account_id: 'j', booking_date: '2025-01-05', amount_cents: -120000, counterparty: 'Katharina Katz', category: 'Miete', category_group: 'Konsum' }),
  tx({ account_id: 'j', booking_date: '2025-02-08', amount_cents: -25000, category: 'Kita & Kinder', category_group: 'Konsum' }),
  tx({ account_id: 'j', booking_date: '2025-03-12', amount_cents: -2000000, purpose: 'Wohnmobilkauf', category: 'Große Einmalposten', category_group: 'Einmalig' }),
];

describe('buildDashboardData', () => {
  it('returns null when there are no accounts', () => {
    expect(buildDashboardData([], [])).toBeNull();
  });

  const D = buildDashboardData(accounts, txns)!;

  it('produces the seven top-level view keys', () => {
    expect(Object.keys(D).sort()).toEqual(['b', 'c', 'cx', 'j', 'jx', 'm', 'tx'].sort());
  });

  it('fills personal metrics and the personal booking count', () => {
    expect(D.m.echtes_eink).toBeCloseTo(3360.6, 2);
    expect(D.m.n_total).toBe(11);
    expect(D.m.months[0]).toBe('2025-01');
  });

  it('builds the giro account object with series and summary', () => {
    const g = D.m.accounts.giro;
    expect(g.series).toHaveLength(12);
    expect(g.end2025).toBeCloseTo(1909.08, 2);
    expect(g.n).toBe(8);
    expect(g.summary['Konsumausgaben']).toBeCloseTo(-582.82, 2);
  });

  it('builds the tagesgeld account object with kind-tagged txns', () => {
    const t = D.m.accounts.tages;
    expect(t.zins).toBeCloseTo(5.23, 2);
    expect(t.dep).toBeCloseTo(500, 2);
    expect(t.wd).toBeCloseTo(300, 2);
    expect(t.txns).toHaveLength(3);
    expect(t.txns.map((x) => x.k).sort()).toEqual(['Entsparen-Abfluss', 'Sparen-Zufluss', 'Zinsen']);
  });

  it('slims personal transactions with literal account labels', () => {
    expect(D.tx).toHaveLength(11);
    const accts = new Set(D.tx.map((t) => t.acct));
    expect(accts).toEqual(new Set(['Giro', 'Tagesgeld']));
    const rewe = D.tx.find((t) => t.e === 'REWE')!;
    expect(rewe.acct).toBe('Giro');
    expect(rewe.a).toBeCloseTo(-42.5, 2);
  });

  it('derives a budget', () => {
    expect(D.b.gehalt_mo).toBeGreaterThan(0);
    expect(Object.keys(D.b.budget).length).toBeGreaterThan(0);
  });

  it('builds the joint view with renamed balance keys', () => {
    expect(D.j.einn_total).toBeCloseTo(1450, 2);
    expect(D.j.end2025).toBeCloseTo(2137.9, 2);
    expect(D.j.n).toBe(6);
    expect(D.jx).toHaveLength(6);
    expect(new Set(D.jx.map((t) => t.acct))).toEqual(new Set(['Gemeinschaft']));
  });

  it('builds the consolidated view and split source list', () => {
    expect(D.c.comb_inc_tot).toBeCloseTo(4010.6, 2);
    expect(D.c.comb_exp_tot).toBeCloseTo(22032.82, 2);
    const srcs = new Set(D.cx.map((t) => t.src));
    expect(srcs).toEqual(new Set(['Hendrik', 'Gemeinschaft']));
    // Hendrik personal entries = giro consumption (REWE + AMEX) = 2
    expect(D.cx.filter((t) => t.src === 'Hendrik')).toHaveLength(2);
  });
});
