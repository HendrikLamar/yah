import { describe, it, expect } from 'vitest';
import {
  detectYear,
  accountSeries,
  giroSummary,
  detectSubs,
  buildBudget,
  personalMetrics,
  jointMetrics,
  consolidatedMetrics,
} from '../analytics';
import type { Transaction } from '../types';

const GIRO_IBAN = 'DE30120300001030293144';
const TAGES_IBAN = 'DE62120300001021068935';
const JOINT_IBAN = 'DE55120300001064640491';

let seq = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${seq++}`,
  account_id: 'g',
  booking_date: '2025-01-15',
  amount_cents: 0,
  counterparty: '',
  purpose: '',
  counterparty_iban: null,
  category: 'Shopping & Sonstiges',
  category_group: 'Konsum',
  is_internal: false,
  ...o,
});

// --- Personal fixture (giro + tages) ---------------------------------------
const giro: Transaction[] = [
  tx({ booking_date: '2025-01-31', amount_cents: 314625, category: 'Einnahmen · Gehalt', category_group: 'Einnahmen' }),
  tx({ booking_date: '2025-02-10', amount_cents: 20912, category: 'Einnahmen · Erstattungen', category_group: 'Einnahmen' }),
  tx({ booking_date: '2025-01-15', amount_cents: -4250, category: 'Lebensmittel & Drogerie', category_group: 'Konsum' }),
  tx({ booking_date: '2025-03-04', amount_cents: -54032, category: 'Kreditkarte (AMEX)', category_group: 'Konsum' }),
  tx({ booking_date: '2025-01-20', amount_cents: -50000, category: 'Sparen & Investitionen', category_group: 'Vermögen' }),
  tx({ booking_date: '2025-04-09', amount_cents: 100000, category: 'Anlage-Auszahlung (Scalable)', category_group: 'Entsparen' }),
  tx({ booking_date: '2025-02-05', amount_cents: -50000, category: 'Interner Transfer (Tagesgeld)', category_group: 'Intern', counterparty_iban: TAGES_IBAN, is_internal: true }),
  tx({ booking_date: '2025-05-05', amount_cents: 30000, category: 'Interner Transfer (Tagesgeld)', category_group: 'Intern', counterparty_iban: TAGES_IBAN, is_internal: true }),
];

const tages: Transaction[] = [
  tx({ account_id: 't', booking_date: '2025-06-30', amount_cents: 523, category: 'Einnahmen · Zinsen', category_group: 'Einnahmen' }),
  tx({ account_id: 't', booking_date: '2025-02-05', amount_cents: 50000, category: 'Sparen (Tagesgeld-Einzahlung)', category_group: 'Vermögen', is_internal: true }),
  tx({ account_id: 't', booking_date: '2025-05-05', amount_cents: -30000, category: 'Entsparen (Tagesgeld-Auszahlung)', category_group: 'Entsparen', is_internal: true }),
];

// --- Joint fixture ----------------------------------------------------------
const joint: Transaction[] = [
  tx({ account_id: 'j', booking_date: '2025-01-02', amount_cents: 80000, category: 'Einzahlung · Hendrik', category_group: 'Einnahmen', counterparty_iban: GIRO_IBAN }),
  tx({ account_id: 'j', booking_date: '2025-01-03', amount_cents: 60000, category: 'Einzahlung · Sina', category_group: 'Einnahmen' }),
  tx({ account_id: 'j', booking_date: '2025-02-03', amount_cents: 5000, category: 'Erstattung / extern', category_group: 'Einnahmen' }),
  tx({ account_id: 'j', booking_date: '2025-01-05', amount_cents: -120000, category: 'Miete', category_group: 'Konsum' }),
  tx({ account_id: 'j', booking_date: '2025-02-08', amount_cents: -25000, category: 'Kita & Kinder', category_group: 'Konsum' }),
  tx({ account_id: 'j', booking_date: '2025-03-12', amount_cents: -2000000, category: 'Große Einmalposten', category_group: 'Einmalig' }),
];

describe('detectYear', () => {
  it('returns the most recent calendar year present', () => {
    expect(detectYear(['2024-12-01', '2025-06-30', '2023-01-01'])).toBe(2025);
  });
  it('falls back to the current year for empty input', () => {
    expect(detectYear([])).toBe(new Date().getFullYear());
  });
});

describe('accountSeries', () => {
  // net of giro fixture = 307255 cents = 3072.55
  it('anchors month-end balances to the end-of-year balance and rolls back the net', () => {
    const r = accountSeries(giro, 2025, 190908); // end-of-year balance 1909.08
    expect(r.net).toBeCloseTo(3072.55, 2);
    expect(r.end).toBeCloseTo(1909.08, 2);
    expect(r.start).toBeCloseTo(1909.08 - 3072.55, 2);
    expect(r.series).toHaveLength(12);
    // December (last) month-end equals the end balance
    expect(r.series[11]).toBeCloseTo(1909.08, 2);
  });
  it('subtracts post-year transactions when deriving the year-end balance', () => {
    const withNext = [...giro, tx({ booking_date: '2026-01-10', amount_cents: 10000 })];
    const r = accountSeries(withNext, 2025, 190908 + 10000); // now-balance includes the Jan 2026 inflow
    expect(r.end).toBeCloseTo(1909.08, 2); // year-end strips the 100.00 post-year inflow
  });
});

describe('personalMetrics', () => {
  const m = personalMetrics(giro, tages, 2025);
  it('totals income components (Gehalt + Erstattungen + Zinsen)', () => {
    expect(m.gehalt_total).toBeCloseTo(3146.25, 2);
    expect(m.erstatt_total).toBeCloseTo(209.12, 2);
    expect(m.zins_total).toBeCloseTo(5.23, 2);
    expect(m.echtes_eink).toBeCloseTo(3360.6, 2);
  });
  it('folds Zinsen into the monthly erstatt series', () => {
    expect(m.erstatt_m[5]).toBeCloseTo(5.23, 2); // June index 5 has the interest
    expect(m.erstatt_m[1]).toBeCloseTo(209.12, 2); // Feb reimbursement
  });
  it('sums consumption and breaks it down by category and month', () => {
    expect(m.konsum_total).toBeCloseTo(582.82, 2);
    expect(m.cat_total['Lebensmittel & Drogerie']).toBeCloseTo(42.5, 2);
    expect(m.cat_total['Kreditkarte (AMEX)']).toBeCloseTo(540.32, 2);
    expect(m.cat_month['Kreditkarte (AMEX)'][2]).toBeCloseTo(540.32, 2); // March index 2
    expect(m.konsum_m[0]).toBeCloseTo(42.5, 2);
  });
  it('computes the wealth movements and savings rate', () => {
    expect(m.spar_ext).toBeCloseTo(500, 2);
    expect(m.spar_tg_dep).toBeCloseTo(500, 2);
    expect(m.tg_wd).toBeCloseTo(300, 2);
    expect(m.anlage_ausz).toBeCloseTo(1000, 2);
    expect(m.spar_brutto).toBeCloseTo(1000, 2);
    expect(m.entsparen).toBeCloseTo(1300, 2);
    expect(m.netto_verm).toBeCloseTo(-300, 2);
    expect(m.sparquote).toBeCloseTo(-8.9, 1);
  });
  it('reports the operating balance and the income correction from internal inflows', () => {
    expect(m.net_operativ).toBeCloseTo(2777.78, 2);
    expect(m.income_correction).toBeCloseTo(300, 2);
  });
});

describe('giroSummary', () => {
  const s = giroSummary(giro);
  it('produces the six labelled giro cashflows that sum to the net change', () => {
    expect(s['Einnahmen (Gehalt + Erstattungen)']).toBeCloseTo(3355.37, 2);
    expect(s['Konsumausgaben']).toBeCloseTo(-582.82, 2);
    expect(s['→ Sparen/Anlagen extern']).toBeCloseTo(-500, 2);
    expect(s['← Anlage-Auszahlung']).toBeCloseTo(1000, 2);
    expect(s['↔ Interner Transfer Tagesgeld']).toBeCloseTo(-200, 2); // -500 + 300
    const sum = Object.values(s).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(3072.55, 2); // == giro net
  });
});

describe('jointMetrics', () => {
  const j = jointMetrics(joint, 2025, 213790);
  it('splits inflows into Sina / Hendrik / external', () => {
    expect(j.sina_total).toBeCloseTo(600, 2);
    expect(j.hendrik_total).toBeCloseTo(800, 2);
    expect(j.ext_total).toBeCloseTo(50, 2);
    expect(j.einn_total).toBeCloseTo(1450, 2);
    expect(j.sina_share).toBeCloseTo(42.9, 1);
  });
  it('totals expenses with and without the big one-off', () => {
    expect(j.ausg_total).toBeCloseTo(21450, 2);
    expect(j.ausg_laufend).toBeCloseTo(1450, 2);
    expect(j.cat_total['Große Einmalposten']).toBeCloseTo(20000, 2);
  });
  it('omits zero categories and keeps positive ones', () => {
    expect(j.cat_total['Miete']).toBeCloseTo(1200, 2);
    expect('Versicherungen' in j.cat_total).toBe(false);
  });
});

describe('consolidatedMetrics', () => {
  const pm = personalMetrics(giro, tages, 2025);
  const jm = jointMetrics(joint, 2025, 213790);
  const c = consolidatedMetrics({ giro, joint, jointIban: JOINT_IBAN, pm, jm, year: 2025 });
  it('combines household income', () => {
    expect(c.hendrik_eink_tot).toBeCloseTo(3360.6, 2);
    expect(c.sina_tot).toBeCloseTo(600, 2);
    expect(c.ext_tot).toBeCloseTo(50, 2);
    expect(c.comb_inc_tot).toBeCloseTo(4010.6, 2);
  });
  it('combines household expenses (personal consumption + joint spend)', () => {
    expect(c.hendrik_personal_tot).toBeCloseTo(582.82, 2);
    expect(c.joint_tot).toBeCloseTo(21450, 2);
    expect(c.comb_exp_tot).toBeCloseTo(22032.82, 2);
    expect(c.einmal).toBeCloseTo(20000, 2);
    expect(c.comb_exp_laufend).toBeCloseTo(2032.82, 2);
  });
  it('computes operating and total net', () => {
    expect(c.comb_net_op).toBeCloseTo(1977.78, 2);
    expect(c.comb_net_all).toBeCloseTo(-18022.22, 2);
  });
  it('merges categories from both sides', () => {
    expect(c.cat_total['Miete']).toBeCloseTo(1200, 2);
    expect(c.cat_total['Kreditkarte (AMEX)']).toBeCloseTo(540.32, 2);
  });
});

describe('detectSubs', () => {
  it('aggregates recurring providers from Abos and Versicherungen by counterparty', () => {
    const subsTx: Transaction[] = [
      tx({ counterparty: 'Spotify AB', amount_cents: -999, category: 'Abos & Medien', category_group: 'Konsum', booking_date: '2025-01-10' }),
      tx({ counterparty: 'Spotify AB', amount_cents: -999, category: 'Abos & Medien', category_group: 'Konsum', booking_date: '2025-02-10' }),
      tx({ counterparty: 'Barmenia Versicherung', amount_cents: -9000, category: 'Versicherungen', category_group: 'Konsum', booking_date: '2025-01-15' }),
      tx({ counterparty: 'REWE', amount_cents: -4250, category: 'Lebensmittel & Drogerie', category_group: 'Konsum', booking_date: '2025-01-15' }),
    ];
    const subs = detectSubs(subsTx);
    const spotify = subs.find((s) => s.name === 'Spotify AB');
    expect(spotify).toBeDefined();
    expect(spotify!.count).toBe(2);
    expect(spotify!.total).toBeCloseTo(19.98, 2);
    expect(spotify!.avg).toBeCloseTo(9.99, 2);
    expect(subs.some((s) => s.name === 'REWE')).toBe(false); // groceries are not subs
  });
});

describe('buildBudget', () => {
  it('derives per-category monthly budgets and splits fixed vs variable', () => {
    const pm = personalMetrics(giro, tages, 2025);
    const b = buildBudget(pm);
    expect(b.budget['Kreditkarte (AMEX)']).toBeCloseTo(Math.round((540.32 / 12) * 100) / 100, 2);
    expect(b.gehalt_mo).toBeCloseTo(Math.round((3146.25 / 12) * 100) / 100, 2);
    expect(b.fix_sum + b.var_sum).toBeGreaterThan(0);
    expect(Array.isArray(b.fix)).toBe(true);
  });
});
