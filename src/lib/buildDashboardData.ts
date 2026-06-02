// Assembles the per-account view consumed by public/dashboard-view.js:
// { meta, accounts: AccountView[], consolidated: ConsolidatedView | null }.
// One AccountView per account that has transactions; a consolidated household
// tab only when 2+ accounts have data. Numeric work lives in analytics.ts.
// All money here is EUR (integer cents only in the DB / analytics input).
import type {
  Account, Transaction, AccountRole, AccountView, ConsolidatedView, DashboardData, SlimTx,
} from './types';
import {
  markInternal, detectYear, accountSeries, expenseBreakdown, incomeExpenseMonthly,
  MONTH_LABELS, monthsOf,
} from './analytics';

const maskIban = (iban: string | null): string =>
  iban && iban.length >= 8 ? `${iban.slice(0, 4)} … ${iban.slice(-4)}` : (iban ?? '');

const monthOf = (d: string) => d.slice(0, 7);
const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;
const addInto = (target: Record<string, number[]>, src: Record<string, number[]>) => {
  for (const [c, arr] of Object.entries(src)) {
    if (!target[c]) target[c] = new Array(12).fill(0);
    arr.forEach((v, i) => { target[c][i] = Math.round((target[c][i] + v) * 100) / 100; });
  }
};

const roleOf = (a: Account): AccountRole =>
  a.is_joint || a.account_type === 'joint' ? 'joint' : a.account_type === 'savings' ? 'tages' : 'giro';

const slim = (t: Transaction): SlimTx => ({
  d: t.booking_date, mo: monthOf(t.booking_date),
  e: (t.counterparty ?? '').slice(0, 40), z: (t.purpose ?? '').slice(0, 90),
  a: t.amount_cents / 100, c: t.category ?? 'Sonstige', int: t.is_internal ? 1 : 0,
});

export function buildDashboardData(accounts: Account[], rawTxns: Transaction[]): DashboardData | null {
  if (!accounts.length) return null;
  const txns = markInternal(rawTxns, accounts);
  const year = detectYear(txns.map((t) => t.booking_date));

  const byAccount = new Map<string, Transaction[]>();
  for (const t of txns) {
    const list = byAccount.get(t.account_id);
    if (list) list.push(t); else byAccount.set(t.account_id, [t]);
  }

  const withData = accounts.filter((a) => (byAccount.get(a.id)?.length ?? 0) > 0);
  if (!withData.length) return null;

  const views: AccountView[] = withData.map((a) => {
    const at = byAccount.get(a.id)!;
    const series = accountSeries(at, year, a.balance_cents ?? 0);
    const { cat_total, cat_month } = expenseBreakdown(at, year);
    const { inc_m, exp_m } = incomeExpenseMonthly(at, year);
    const income = sum(inc_m);
    const expenses = sum(exp_m);
    return {
      id: a.id,
      role: roleOf(a),
      label: a.display_name ?? a.name,
      shared: a.is_joint,
      iban: maskIban(a.iban),
      n: at.length,
      now: (a.balance_cents ?? 0) / 100,
      start: series.start, end: series.end, net: series.net, series: series.series,
      months: monthsOf(year), mlabels: MONTH_LABELS,
      income, expenses, net_op: Math.round((income - expenses) * 100) / 100,
      inc_m, exp_m, cat_total, cat_month,
      tx: [...at].sort((x, y) => x.booking_date.localeCompare(y.booking_date)).map(slim),
    };
  });

  const meta = {
    year,
    n_total: txns.length,
    n_accounts: views.length,
    total_balance: sum(withData.map((a) => (a.balance_cents ?? 0) / 100)),
  };

  let consolidated: ConsolidatedView | null = null;
  if (views.length >= 2) {
    const inc_m = new Array(12).fill(0);
    const exp_m = new Array(12).fill(0);
    const cat_total: Record<string, number> = {};
    const cat_month: Record<string, number[]> = {};
    const ctx: (SlimTx & { acct: string })[] = [];
    for (const v of views) {
      v.inc_m.forEach((x, i) => { inc_m[i] = Math.round((inc_m[i] + x) * 100) / 100; });
      v.exp_m.forEach((x, i) => { exp_m[i] = Math.round((exp_m[i] + x) * 100) / 100; });
      for (const [c, t] of Object.entries(v.cat_total)) cat_total[c] = Math.round(((cat_total[c] ?? 0) + t) * 100) / 100;
      addInto(cat_month, v.cat_month);
      for (const row of v.tx) ctx.push({ ...row, acct: v.label });
    }
    const income = sum(inc_m);
    const expenses = sum(exp_m);
    consolidated = {
      months: monthsOf(year), mlabels: MONTH_LABELS,
      total_balance: meta.total_balance,
      income, expenses, net_op: Math.round((income - expenses) * 100) / 100,
      inc_m, exp_m, cat_total, cat_month,
      accounts: views.map((v) => ({ id: v.id, label: v.label, role: v.role, balance: v.now, net: v.net })),
      tx: ctx.sort((x, y) => x.d.localeCompare(y.d)),
    };
  }

  return { meta, accounts: views, consolidated };
}
