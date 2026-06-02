import { describe, it, expect } from 'vitest';
import { expenseBreakdown, incomeExpenseMonthly } from '../analytics';
import type { Transaction } from '../types';

let seq = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${seq++}`, account_id: 'a', booking_date: '2025-01-15', amount_cents: 0,
  counterparty: '', purpose: '', counterparty_iban: null,
  category: 'Shopping & Sonstiges', category_group: 'Konsum', is_internal: false, ...o,
});

const txns: Transaction[] = [
  tx({ booking_date: '2025-01-31', amount_cents: 314625, category: 'Einnahmen · Gehalt' }),
  tx({ booking_date: '2025-03-04', amount_cents: -54032, category: 'Kreditkarte (AMEX)' }),
  tx({ booking_date: '2025-01-15', amount_cents: -4250, category: 'Lebensmittel & Drogerie' }),
  tx({ booking_date: '2025-01-20', amount_cents: -1000, category: 'Lebensmittel & Drogerie' }),
  // internal transfer must be ignored on both sides
  tx({ booking_date: '2025-02-05', amount_cents: -50000, category: 'Interner Transfer', is_internal: true }),
  tx({ booking_date: '2025-05-05', amount_cents: 30000, category: 'Interner Transfer', is_internal: true }),
  // prior year must be ignored
  tx({ booking_date: '2024-12-31', amount_cents: -9999, category: 'Kreditkarte (AMEX)' }),
  // uncategorised expense falls back to a default bucket
  tx({ booking_date: '2025-04-01', amount_cents: -500, category: null }),
];

describe('expenseBreakdown', () => {
  const { cat_total, cat_month } = expenseBreakdown(txns, 2025);
  it('sums in-year non-internal expenses per category as positive EUR', () => {
    expect(cat_total['Kreditkarte (AMEX)']).toBeCloseTo(540.32, 2);
    expect(cat_total['Lebensmittel & Drogerie']).toBeCloseTo(52.5, 2);
  });
  it('buckets uncategorised expenses under a default label', () => {
    expect(cat_total['Sonstige']).toBeCloseTo(5, 2);
  });
  it('excludes internal transfers, income, and prior-year rows', () => {
    expect('Interner Transfer' in cat_total).toBe(false);
    expect('Einnahmen · Gehalt' in cat_total).toBe(false);
    // 2024 AMEX row excluded -> only the 540.32 from March remains
    expect(cat_total['Kreditkarte (AMEX)']).toBeCloseTo(540.32, 2);
  });
  it('produces 12-month arrays placing spend in the right month', () => {
    expect(cat_month['Kreditkarte (AMEX)']).toHaveLength(12);
    expect(cat_month['Kreditkarte (AMEX)'][2]).toBeCloseTo(540.32, 2); // March
    expect(cat_month['Lebensmittel & Drogerie'][0]).toBeCloseTo(52.5, 2); // January
  });
});

describe('incomeExpenseMonthly', () => {
  const { inc_m, exp_m } = incomeExpenseMonthly(txns, 2025);
  it('returns 12-element EUR arrays', () => {
    expect(inc_m).toHaveLength(12);
    expect(exp_m).toHaveLength(12);
  });
  it('places non-internal income and expenses in the right months', () => {
    expect(inc_m[0]).toBeCloseTo(3146.25, 2); // January salary
    expect(exp_m[2]).toBeCloseTo(540.32, 2); // March AMEX
    expect(exp_m[0]).toBeCloseTo(52.5, 2); // January groceries
  });
  it('ignores internal transfers and prior-year rows', () => {
    const incTotal = inc_m.reduce((a, b) => a + b, 0);
    const expTotal = exp_m.reduce((a, b) => a + b, 0);
    expect(incTotal).toBeCloseTo(3146.25, 2);
    expect(expTotal).toBeCloseTo(540.32 + 52.5 + 5, 2);
  });
});
