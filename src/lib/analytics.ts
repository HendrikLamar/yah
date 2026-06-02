// Pure aggregation helpers that turn classified DB transactions into the exact
// numbers the approved dashboard view renders. Transactions arrive already
// classified (category + category_group set at import time, see categorize.ts).
// Money is stored in integer cents; every value returned here is in EUR
// (rounded to 2 decimals) because public/dashboard-view.js consumes EUR.
// Ported from the Python prototype in docs/python/ (metrics3 / joint / consolidate).
import type { Account, Transaction } from './types';

export const MONTH_LABELS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

const eurc = (cents: number) => Math.round(cents) / 100; // integer cents -> EUR
const round2 = (x: number) => Math.round(x * 100) / 100;
const round1 = (x: number) => Math.round(x * 10) / 10;

export function monthsOf(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}
const monthIndex = (date: string) => Number(date.slice(5, 7)) - 1;
const inYear = (t: Transaction, year: number) => t.booking_date.slice(0, 4) === String(year);

export function detectYear(dates: string[]): number {
  if (!dates.length) return new Date().getFullYear();
  return dates.reduce((max, d) => Math.max(max, Number(d.slice(0, 4))), 0);
}

// Flag transfers between the user's own accounts so they don't count as
// income/expense. Used by the assembly layer before aggregating.
export function markInternal(txns: Transaction[], accounts: Account[]): Transaction[] {
  const ownIbans = new Set(accounts.map((a) => a.iban).filter(Boolean) as string[]);
  return txns.map((t) => ({
    ...t,
    is_internal: t.is_internal || (!!t.counterparty_iban && ownIbans.has(t.counterparty_iban)),
  }));
}

// Accumulate cents per ISO month, returned as a 12-element EUR array for `year`.
function monthlyEur(txns: Transaction[], year: number, value: (t: Transaction) => number): number[] {
  const cents = new Array(12).fill(0);
  for (const t of txns) {
    if (!inYear(t, year)) continue;
    cents[monthIndex(t.booking_date)] += value(t);
  }
  return cents.map(eurc);
}
const sumCents = (txns: Transaction[], value: (t: Transaction) => number) =>
  txns.reduce((s, t) => s + value(t), 0);

// Month-end balance series for one account, anchored to the year-end balance.
// `endBalanceCents` is the current Kontostand from the CSV; post-year activity
// is rolled back so the December figure reflects the end of `year`.
export interface AccountSeries { start: number; end: number; net: number; series: number[]; }
export function accountSeries(txns: Transaction[], year: number, endBalanceCents: number): AccountSeries {
  const yearTx = txns.filter((t) => inYear(t, year));
  const postYearCents = sumCents(txns.filter((t) => Number(t.booking_date.slice(0, 4)) > year), (t) => t.amount_cents);
  const endCents = endBalanceCents - postYearCents;
  const netCents = sumCents(yearTx, (t) => t.amount_cents);
  const startCents = endCents - netCents;
  const byMonth = new Array(12).fill(0);
  for (const t of yearTx) byMonth[monthIndex(t.booking_date)] += t.amount_cents;
  let cum = startCents;
  const series = byMonth.map((c) => eurc((cum += c)));
  return { start: eurc(startCents), end: eurc(endCents), net: eurc(netCents), series };
}

// ---------------------------------------------------------------------------
// Generic per-account aggregations (role-agnostic; used by the per-account view)
// ---------------------------------------------------------------------------
const DEFAULT_EXPENSE_CAT = 'Sonstige';

// Expense categories and their monthly breakdown for one account's transactions.
// Counts only in-year, non-internal outflows; values are positive EUR.
export interface ExpenseBreakdown { cat_total: Record<string, number>; cat_month: Record<string, number[]>; }
export function expenseBreakdown(txns: Transaction[], year: number): ExpenseBreakdown {
  const totC: Record<string, number> = {};
  const monC: Record<string, number[]> = {};
  for (const t of txns) {
    if (!inYear(t, year) || t.is_internal || t.amount_cents >= 0) continue;
    const cat = t.category ?? DEFAULT_EXPENSE_CAT;
    if (!(cat in totC)) { totC[cat] = 0; monC[cat] = new Array(12).fill(0); }
    totC[cat] += -t.amount_cents;
    monC[cat][monthIndex(t.booking_date)] += -t.amount_cents;
  }
  const cat_total: Record<string, number> = {};
  const cat_month: Record<string, number[]> = {};
  for (const c of Object.keys(totC)) { cat_total[c] = eurc(totC[c]); cat_month[c] = monC[c].map(eurc); }
  return { cat_total, cat_month };
}

// Monthly income (positive) and expense (abs of negative) EUR arrays for one
// account, excluding internal transfers between the user's own accounts.
export interface IncomeExpenseMonthly { inc_m: number[]; exp_m: number[]; }
export function incomeExpenseMonthly(txns: Transaction[], year: number): IncomeExpenseMonthly {
  const incCents = new Array(12).fill(0);
  const expCents = new Array(12).fill(0);
  for (const t of txns) {
    if (!inYear(t, year) || t.is_internal) continue;
    const mi = monthIndex(t.booking_date);
    if (t.amount_cents > 0) incCents[mi] += t.amount_cents;
    else expCents[mi] += -t.amount_cents;
  }
  return { inc_m: incCents.map(eurc), exp_m: expCents.map(eurc) };
}

// ---------------------------------------------------------------------------
// Personal (Giro + Tagesgeld)
// ---------------------------------------------------------------------------
const KONSUM_CATS = [
  'Wohnen & Haushalt','Kredite & Darlehen','Lebensmittel & Drogerie','Versicherungen',
  'Abos & Medien','Mobilität & Reise','Restaurants & Gastronomie','Gesundheit',
  'Shopping & Sonstiges','Kreditkarte (AMEX)','Bargeld','Spenden & Beiträge','Steuern & Gebühren',
];

export interface PersonalMetrics {
  months: string[]; mlabels: string[];
  gehalt_m: number[]; erstatt_m: number[]; konsum_m: number[]; net_m: number[];
  gehalt_total: number; erstatt_total: number; zins_total: number; echtes_eink: number;
  konsum_total: number; net_operativ: number;
  spar_ext: number; spar_tg_dep: number; tg_wd: number; anlage_ausz: number;
  spar_brutto: number; entsparen: number; netto_verm: number; sparquote: number;
  income_correction: number;
  cat_total: Record<string, number>; cat_n: Record<string, number>; cat_month: Record<string, number[]>;
}

export function personalMetrics(giro: Transaction[], tages: Transaction[], year: number): PersonalMetrics {
  const g = giro.filter((t) => inYear(t, year));
  const tg = tages.filter((t) => inYear(t, year));

  const gehalt_m = monthlyEur(g, year, (t) => (t.category === 'Einnahmen · Gehalt' ? t.amount_cents : 0));
  const erstattCents = monthlyEur(g, year, (t) => (t.category === 'Einnahmen · Erstattungen' ? t.amount_cents : 0));
  const zinsCents = monthlyEur(tg, year, (t) => (t.category === 'Einnahmen · Zinsen' ? t.amount_cents : 0));
  const erstatt_m = erstattCents.map((v, i) => round2(v + zinsCents[i]));

  const cat_total: Record<string, number> = {};
  const cat_n: Record<string, number> = {};
  const cat_month: Record<string, number[]> = {};
  for (const c of KONSUM_CATS) { cat_total[c] = 0; cat_n[c] = 0; cat_month[c] = new Array(12).fill(0); }
  for (const t of g) {
    if (t.amount_cents >= 0 || !KONSUM_CATS.includes(t.category ?? '')) continue;
    const c = t.category as string;
    cat_total[c] += -t.amount_cents; cat_n[c] += 1; cat_month[c][monthIndex(t.booking_date)] += -t.amount_cents;
  }
  const konsum_m = monthsOf(year).map((_, i) => round2(KONSUM_CATS.reduce((s, c) => s + cat_month[c][i] / 100, 0)));
  for (const c of KONSUM_CATS) { cat_total[c] = eurc(cat_total[c]); cat_month[c] = cat_month[c].map(eurc); }

  const gehalt_total = round2(gehalt_m.reduce((a, b) => a + b, 0));
  const erstatt_total = eurc(sumCents(g, (t) => (t.category === 'Einnahmen · Erstattungen' ? t.amount_cents : 0)));
  const zins_total = eurc(sumCents(tg, (t) => (t.category === 'Einnahmen · Zinsen' ? t.amount_cents : 0)));
  const echtes_eink = round2(gehalt_total + erstatt_total + zins_total);
  const konsum_total = round2(Object.values(cat_total).reduce((a, b) => a + b, 0));
  const net_operativ = round2(echtes_eink - konsum_total);
  const net_m = monthsOf(year).map((_, i) => round2(gehalt_m[i] + erstatt_m[i] - konsum_m[i]));

  const spar_ext = eurc(sumCents(g, (t) => (t.category === 'Sparen & Investitionen' ? -t.amount_cents : 0)));
  const spar_tg_dep = eurc(sumCents(tg, (t) => (t.category === 'Sparen (Tagesgeld-Einzahlung)' ? t.amount_cents : 0)));
  const tg_wd = eurc(sumCents(tg, (t) => (t.category === 'Entsparen (Tagesgeld-Auszahlung)' ? -t.amount_cents : 0)));
  const anlage_ausz = eurc(sumCents(g, (t) => (t.category === 'Anlage-Auszahlung (Scalable)' ? t.amount_cents : 0)));
  const spar_brutto = round2(spar_ext + spar_tg_dep);
  const entsparen = round2(tg_wd + anlage_ausz);
  const netto_verm = round2(spar_brutto - entsparen);
  const sparquote = echtes_eink ? round1((netto_verm / echtes_eink) * 100) : 0;
  const income_correction = eurc(sumCents(g, (t) => (t.is_internal && t.amount_cents > 0 ? t.amount_cents : 0)));

  return {
    months: monthsOf(year), mlabels: MONTH_LABELS,
    gehalt_m, erstatt_m, konsum_m, net_m,
    gehalt_total, erstatt_total, zins_total, echtes_eink, konsum_total, net_operativ,
    spar_ext, spar_tg_dep, tg_wd, anlage_ausz, spar_brutto, entsparen, netto_verm, sparquote,
    income_correction, cat_total, cat_n, cat_month,
  };
}

// The six labelled giro cashflows shown in the account detail; they sum to net.
export function giroSummary(giro: Transaction[]): Record<string, number> {
  const sum = (pred: (t: Transaction) => number) => eurc(sumCents(giro, pred));
  return {
    'Einnahmen (Gehalt + Erstattungen)': sum((t) =>
      t.category === 'Einnahmen · Gehalt' || t.category === 'Einnahmen · Erstattungen' ? t.amount_cents : 0),
    'Konsumausgaben': sum((t) => (t.amount_cents < 0 && KONSUM_CATS.includes(t.category ?? '') ? t.amount_cents : 0)),
    '→ Sparen/Anlagen extern': sum((t) => (t.category === 'Sparen & Investitionen' ? t.amount_cents : 0)),
    '← Anlage-Auszahlung': sum((t) => (t.category === 'Anlage-Auszahlung (Scalable)' ? t.amount_cents : 0)),
    'Darlehen / sonst. Transfers': sum((t) => (t.category === 'Darlehen / sonst. Transfer' ? t.amount_cents : 0)),
    '↔ Interner Transfer Tagesgeld': sum((t) => (t.is_internal ? t.amount_cents : 0)),
  };
}

// ---------------------------------------------------------------------------
// Joint / Gemeinschaftskonto
// ---------------------------------------------------------------------------
const JOINT_CATS = [
  'Große Einmalposten','Miete','Kita & Kinder','Lebensmittel & Drogerie','Energie, Telekom & Rundfunk',
  'Versicherungen','Haustier & Tierarzt','Gesundheit & Freizeit','Mobilität & Reise','Restaurants & Gastronomie',
  'Shopping & Sonstiges','Transfers / Privat','Steuern & Gebühren',
];

export interface JointMetrics {
  months: string[]; mlabels: string[];
  inc_sina: number[]; inc_hendrik: number[]; inc_ext: number[]; ausg_m: number[];
  cat_total: Record<string, number>; cat_n: Record<string, number>; cat_month: Record<string, number[]>;
  sina_total: number; hendrik_total: number; ext_total: number; einn_total: number;
  ausg_total: number; ausg_laufend: number; sina_share: number;
  start: number; end: number; net: number; now: number; n: number; series: number[];
}

export function jointMetrics(txns: Transaction[], year: number, endBalanceCents: number): JointMetrics {
  const j = txns.filter((t) => inYear(t, year));
  const inc_sina = monthlyEur(j, year, (t) => (t.amount_cents > 0 && t.category === 'Einzahlung · Sina' ? t.amount_cents : 0));
  const inc_hendrik = monthlyEur(j, year, (t) => (t.amount_cents > 0 && t.category === 'Einzahlung · Hendrik' ? t.amount_cents : 0));
  const inc_ext = monthlyEur(j, year, (t) =>
    t.amount_cents > 0 && t.category !== 'Einzahlung · Sina' && t.category !== 'Einzahlung · Hendrik' ? t.amount_cents : 0);

  const totC: Record<string, number> = {};
  const nC: Record<string, number> = {};
  const monC: Record<string, number[]> = {};
  for (const c of JOINT_CATS) { totC[c] = 0; nC[c] = 0; monC[c] = new Array(12).fill(0); }
  for (const t of j) {
    if (t.amount_cents >= 0 || !JOINT_CATS.includes(t.category ?? '')) continue;
    const c = t.category as string;
    totC[c] += -t.amount_cents; nC[c] += 1; monC[c][monthIndex(t.booking_date)] += -t.amount_cents;
  }
  const ausg_m = monthsOf(year).map((_, i) => round2(JOINT_CATS.reduce((s, c) => s + monC[c][i] / 100, 0)));
  const cat_total: Record<string, number> = {};
  const cat_n: Record<string, number> = {};
  const cat_month: Record<string, number[]> = {};
  for (const c of JOINT_CATS) {
    if (totC[c] <= 0) continue;
    cat_total[c] = eurc(totC[c]); cat_n[c] = nC[c]; cat_month[c] = monC[c].map(eurc);
  }
  const ausg_total = round2(Object.values(cat_total).reduce((a, b) => a + b, 0));
  const sina_total = round2(inc_sina.reduce((a, b) => a + b, 0));
  const hendrik_total = round2(inc_hendrik.reduce((a, b) => a + b, 0));
  const ext_total = round2(inc_ext.reduce((a, b) => a + b, 0));
  const einn_total = round2(sina_total + hendrik_total + ext_total);
  const ausg_laufend = round2(ausg_total - (cat_total['Große Einmalposten'] ?? 0));
  const sina_share = sina_total + hendrik_total ? round1((sina_total / (sina_total + hendrik_total)) * 100) : 0;
  const s = accountSeries(txns, year, endBalanceCents);

  return {
    months: monthsOf(year), mlabels: MONTH_LABELS,
    inc_sina, inc_hendrik, inc_ext, ausg_m, cat_total, cat_n, cat_month,
    sina_total, hendrik_total, ext_total, einn_total, ausg_total, ausg_laufend, sina_share,
    start: s.start, end: s.end, net: s.net, now: eurc(endBalanceCents), n: j.length, series: s.series,
  };
}

// ---------------------------------------------------------------------------
// Consolidated household view
// ---------------------------------------------------------------------------
const HARMONISE: Record<string, string> = { Gesundheit: 'Gesundheit & Freizeit' };

export interface ConsolidatedMetrics {
  months: string[]; mlabels: string[];
  hendrik_eink_m: number[]; sina_m: number[]; ext_m: number[];
  comb_inc_m: number[]; comb_exp_m: number[]; comb_net_m: number[];
  hendrik_eink_tot: number; sina_tot: number; ext_tot: number; comb_inc_tot: number; hendrik_share: number;
  cat_total: Record<string, number>; cat_n: Record<string, number>; cat_month: Record<string, number[]>;
  comb_exp_tot: number; einmal: number; comb_exp_laufend: number;
  comb_net_op: number; comb_net_all: number;
  hendrik_personal_tot: number; joint_tot: number;
}

export function consolidatedMetrics(args: {
  giro: Transaction[]; joint: Transaction[]; jointIban: string | null;
  pm: PersonalMetrics; jm: JointMetrics; year: number;
}): ConsolidatedMetrics {
  const { giro, joint, jointIban, pm, jm, year } = args;
  const konsumKeys = new Set(KONSUM_CATS);
  const totC: Record<string, number> = {};
  const nC: Record<string, number> = {};
  const monC: Record<string, number[]> = {};
  const add = (cat: string, mi: number, cents: number) => {
    if (!(cat in totC)) { totC[cat] = 0; nC[cat] = 0; monC[cat] = new Array(12).fill(0); }
    totC[cat] += cents; nC[cat] += 1; monC[cat][mi] += cents;
  };
  const hendrikPersonalM = new Array(12).fill(0);
  const jointM = new Array(12).fill(0);

  for (const t of giro) {
    if (!inYear(t, year) || t.amount_cents >= 0) continue;
    if (jointIban && t.counterparty_iban === jointIban) continue; // netted: replaced by joint detail
    if (!konsumKeys.has(t.category ?? '')) continue;
    const cat = HARMONISE[t.category as string] ?? (t.category as string);
    const mi = monthIndex(t.booking_date);
    add(cat, mi, -t.amount_cents); hendrikPersonalM[mi] += -t.amount_cents;
  }
  for (const t of joint) {
    if (!inYear(t, year) || t.amount_cents >= 0) continue;
    const cat = t.category as string;
    const mi = monthIndex(t.booking_date);
    add(cat, mi, -t.amount_cents); jointM[mi] += -t.amount_cents;
  }

  const hendrik_eink_m = pm.gehalt_m.map((v, i) => round2(v + pm.erstatt_m[i]));
  const sina_m = jm.inc_sina; const ext_m = jm.inc_ext;
  const comb_inc_m = hendrik_eink_m.map((v, i) => round2(v + sina_m[i] + ext_m[i]));
  const comb_exp_m = monthsOf(year).map((_, i) => eurc(hendrikPersonalM[i] + jointM[i]));
  const comb_net_m = comb_inc_m.map((v, i) => round2(v - comb_exp_m[i]));

  const cat_total: Record<string, number> = {};
  const cat_month: Record<string, number[]> = {};
  for (const c of Object.keys(totC)) { cat_total[c] = eurc(totC[c]); cat_month[c] = monC[c].map(eurc); }

  const hendrik_eink_tot = pm.echtes_eink; const sina_tot = jm.sina_total; const ext_tot = jm.ext_total;
  const comb_inc_tot = round2(hendrik_eink_tot + sina_tot + ext_tot);
  const comb_exp_tot = round2(Object.values(cat_total).reduce((a, b) => a + b, 0));
  const einmal = round2(cat_total['Große Einmalposten'] ?? 0);
  const comb_exp_laufend = round2(comb_exp_tot - einmal);
  const comb_net_op = round2(comb_inc_tot - comb_exp_laufend);
  const comb_net_all = round2(comb_inc_tot - comb_exp_tot);
  const hendrik_personal_tot = eurc(hendrikPersonalM.reduce((a, b) => a + b, 0));
  const joint_tot = eurc(jointM.reduce((a, b) => a + b, 0));
  const hendrik_share = hendrik_eink_tot + sina_tot ? round1((hendrik_eink_tot / (hendrik_eink_tot + sina_tot)) * 100) : 0;

  return {
    months: monthsOf(year), mlabels: MONTH_LABELS,
    hendrik_eink_m, sina_m, ext_m, comb_inc_m, comb_exp_m, comb_net_m,
    hendrik_eink_tot, sina_tot, ext_tot, comb_inc_tot, hendrik_share,
    cat_total, cat_n: nC, cat_month,
    comb_exp_tot, einmal, comb_exp_laufend, comb_net_op, comb_net_all,
    hendrik_personal_tot, joint_tot,
  };
}

// ---------------------------------------------------------------------------
// Subscriptions & budget
// ---------------------------------------------------------------------------
const SUB_CATS = new Set(['Abos & Medien', 'Versicherungen']);
export interface Sub { name: string; count: number; avg: number; total: number; }

export function detectSubs(txns: Transaction[]): Sub[] {
  const map = new Map<string, { count: number; cents: number }>();
  for (const t of txns) {
    if (t.amount_cents >= 0 || !SUB_CATS.has(t.category ?? '')) continue;
    const name = (t.counterparty ?? '').trim() || '(unbekannt)';
    const e = map.get(name) ?? { count: 0, cents: 0 };
    e.count += 1; e.cents += -t.amount_cents; map.set(name, e);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, count: v.count, total: eurc(v.cents), avg: round2(eurc(v.cents) / v.count) }))
    .sort((a, b) => b.total - a.total);
}

const FIX_CATS = new Set(['Wohnen & Haushalt', 'Versicherungen', 'Abos & Medien', 'Kredite & Darlehen']);
export interface Budget { budget: Record<string, number>; fix: string[]; fix_sum: number; var_sum: number; gehalt_mo: number; }

export function buildBudget(pm: PersonalMetrics): Budget {
  const budget: Record<string, number> = {};
  for (const [c, total] of Object.entries(pm.cat_total)) {
    if (total > 0) budget[c] = round2(total / 12);
  }
  const fix = Object.keys(budget).filter((c) => FIX_CATS.has(c));
  const fix_sum = round2(fix.reduce((s, c) => s + budget[c], 0));
  const var_sum = round2(Object.keys(budget).filter((c) => !FIX_CATS.has(c)).reduce((s, c) => s + budget[c], 0));
  const gehalt_mo = round2(pm.gehalt_total / 12);
  return { budget, fix, fix_sum, var_sum, gehalt_mo };
}
