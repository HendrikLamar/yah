// Pure aggregation helpers that turn raw DB transactions into the numbers the
// dashboard renders. Money is handled in integer cents everywhere; the view
// divides by 100. Mirrors the logic from the original Python analysis.
import type { Account, Transaction } from './types';

const MONTHS = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}`);
const LABELS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const monthOf = (d: string) => d.slice(0, 7);

// Flag transfers between the user's own accounts so they don't count as
// income/expense. Call once after fetching, before aggregating.
export function markInternal(txns: Transaction[], accounts: Account[]): Transaction[] {
  const ownIbans = new Set(accounts.map((a) => a.iban).filter(Boolean) as string[]);
  return txns.map((t) => ({
    ...t,
    is_internal: t.is_internal || (!!t.counterparty_iban && ownIbans.has(t.counterparty_iban)),
  }));
}

export interface CashflowResult {
  months: string[]; labels: string[];
  incomeByMonth: number[]; expenseByMonth: number[]; netByMonth: number[];
  incomeTotal: number; expenseTotal: number; net: number;
}

// Cashflow for ONE set of transactions (e.g. the user's personal accounts).
export function cashflow(txns: Transaction[]): CashflowResult {
  const inc = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  const exp = Object.fromEntries(MONTHS.map((m) => [m, 0]));
  for (const t of txns) {
    if (t.is_internal || t.category_group === 'Intern') continue;
    const m = monthOf(t.booking_date);
    if (!(m in inc)) continue;
    if (t.category_group === 'Einnahmen') inc[m] += t.amount_cents;
    else if (t.amount_cents < 0 && t.category_group === 'Konsum') exp[m] += -t.amount_cents;
  }
  const incomeByMonth = MONTHS.map((m) => inc[m]);
  const expenseByMonth = MONTHS.map((m) => exp[m]);
  return {
    months: MONTHS, labels: LABELS, incomeByMonth, expenseByMonth,
    netByMonth: MONTHS.map((_, i) => incomeByMonth[i] - expenseByMonth[i]),
    incomeTotal: incomeByMonth.reduce((a, b) => a + b, 0),
    expenseTotal: expenseByMonth.reduce((a, b) => a + b, 0),
    net: incomeByMonth.reduce((a, b) => a + b, 0) - expenseByMonth.reduce((a, b) => a + b, 0),
  };
}

export interface CategoryAgg { category: string; total: number; count: number; byMonth: number[]; }

export function byCategory(txns: Transaction[]): CategoryAgg[] {
  const map = new Map<string, { total: number; count: number; byMonth: number[] }>();
  for (const t of txns) {
    if (t.amount_cents >= 0 || t.is_internal || t.category_group !== 'Konsum') continue;
    const cat = t.category ?? 'Sonstiges';
    if (!map.has(cat)) map.set(cat, { total: 0, count: 0, byMonth: MONTHS.map(() => 0) });
    const e = map.get(cat)!;
    e.total += -t.amount_cents; e.count += 1;
    const mi = MONTHS.indexOf(monthOf(t.booking_date));
    if (mi >= 0) e.byMonth[mi] += -t.amount_cents;
  }
  return [...map.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total);
}

// Consolidated household view: personal accounts + joint account, with the
// user's transfers to the joint account netted out (they're internal to the
// household). `personal` = txns on giro/savings, `joint` = joint account txns.
export function consolidate(personal: Transaction[], joint: Transaction[], jointIban: string | null) {
  // Drop personal transfers that went to the joint account (avoid double count).
  const personalReal = personal.filter(
    (t) => !(t.amount_cents < 0 && t.counterparty_iban === jointIban)
  );
  const personalConsumption = personalReal.filter((t) => t.amount_cents < 0 && t.category_group === 'Konsum');
  const jointConsumption = joint.filter((t) => t.amount_cents < 0);
  const all = [...personalConsumption, ...jointConsumption];
  return {
    expenseTotal: all.reduce((s, t) => s + -t.amount_cents, 0),
    categories: byCategory(all),
    personalTotal: personalConsumption.reduce((s, t) => s + -t.amount_cents, 0),
    jointTotal: jointConsumption.reduce((s, t) => s + -t.amount_cents, 0),
  };
}
