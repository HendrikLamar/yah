// Assembles the JSON shape that /public/dashboard-view.js expects.
// This is the main porting task from the Python prototype: the rendering
// script consumes { m, b, tx, j, jx, c, cx } (see docs/DATA_SHAPE.md).
// analytics.ts already provides cashflow() + byCategory() + consolidate();
// fill the remaining fields (subs, budget, account series, contribution split)
// incrementally. Returns null when the user has no data yet (-> show CTA).
import type { Account, Transaction } from './types';
import { cashflow, byCategory, consolidate, markInternal } from './analytics';

export function buildDashboardData(accounts: Account[], txns: Transaction[]) {
  if (!accounts.length) return null;
  const tx = markInternal(txns, accounts);

  const personalAccs = accounts.filter((a) => !a.is_joint);
  const jointAcc = accounts.find((a) => a.is_joint) ?? null;
  const personalIds = new Set(personalAccs.map((a) => a.id));
  const personalTx = tx.filter((t) => personalIds.has(t.account_id));
  const jointTx = jointAcc ? tx.filter((t) => t.account_id === jointAcc.id) : [];

  const cf = cashflow(personalTx);
  const cats = byCategory(personalTx);
  const con = consolidate(personalTx, jointTx, jointAcc?.iban ?? null);

  // NOTE: the keys below mirror the prototype. Several sub-objects
  // (subs, budget, account.series, joint contribution split) still need to be
  // computed — see docs/DATA_SHAPE.md and the Python scripts in docs/python/.
  return {
    m: {
      months: cf.months, mlabels: cf.labels,
      n_total: tx.length,
      konsum_total: cf.expenseTotal / 100,
      // TODO: gehalt_total, erstatt_total, net_operativ, accounts.{giro,tages}, subs, etc.
      cat_total: Object.fromEntries(cats.map((c) => [c.category, c.total / 100])),
      cat_month: Object.fromEntries(cats.map((c) => [c.category, c.byMonth.map((v) => v / 100)])),
    },
    b: { budget: {}, fix: [], fix_sum: 0, var_sum: 0, gehalt_mo: 0 }, // TODO budget engine
    tx: tx.map(slim),
    j: { /* TODO joint metrics */ },
    jx: jointTx.map(slim),
    c: { comb_exp_tot: con.expenseTotal / 100, /* TODO consolidated metrics */ },
    cx: [],
  };
}

const slim = (t: Transaction) => ({
  acct: t.account_id, d: t.booking_date, mo: t.booking_date.slice(0, 7),
  e: t.counterparty ?? '', z: t.purpose ?? '', a: t.amount_cents / 100,
  c: t.category ?? 'Sonstiges', int: t.is_internal ? 1 : 0,
});
