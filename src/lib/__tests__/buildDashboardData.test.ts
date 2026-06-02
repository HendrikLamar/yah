import { describe, it, expect } from 'vitest';
import { buildDashboardData } from '../buildDashboardData';
import type { Account, Transaction } from '../types';

const GIRO_IBAN = 'DE30120300001030293144';
const TAGES_IBAN = 'DE62120300001021068935';
const JOINT_IBAN = 'DE55120300001064640491';

const giroAcc: Account = { id: 'g', iban: GIRO_IBAN, name: 'Girokonto', account_type: 'giro', is_joint: false, balance_cents: 190908, owner_label: 'Hendrik', display_name: null };
const tagesAcc: Account = { id: 't', iban: TAGES_IBAN, name: 'Tagesgeldkonto', account_type: 'savings', is_joint: false, balance_cents: 290522, owner_label: 'Hendrik', display_name: null };
const jointAcc: Account = { id: 'j', iban: JOINT_IBAN, name: 'Gemeinschaftskonto', account_type: 'joint', is_joint: true, balance_cents: 213790, owner_label: 'Hendrik', display_name: null };

let seq = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${seq++}`, account_id: 'g', booking_date: '2025-01-15', amount_cents: 0,
  counterparty: '', purpose: '', counterparty_iban: null,
  category: 'Shopping & Sonstiges', category_group: 'Konsum', is_internal: false, ...o,
});

const giroTx: Transaction[] = [
  tx({ account_id: 'g', booking_date: '2025-01-31', amount_cents: 314625, category: 'Einnahmen · Gehalt' }),
  tx({ account_id: 'g', booking_date: '2025-01-15', amount_cents: -4250, counterparty: 'REWE', category: 'Lebensmittel & Drogerie' }),
  tx({ account_id: 'g', booking_date: '2025-03-04', amount_cents: -54032, category: 'Kreditkarte (AMEX)' }),
];
const jointTx: Transaction[] = [
  tx({ account_id: 'j', booking_date: '2025-01-03', amount_cents: 60000, category: 'Einzahlung · Sina' }),
  tx({ account_id: 'j', booking_date: '2025-01-05', amount_cents: -120000, category: 'Miete' }),
];

describe('buildDashboardData', () => {
  it('returns null when there are no accounts', () => {
    expect(buildDashboardData([], [])).toBeNull();
  });

  it('returns null when no account has any transaction', () => {
    expect(buildDashboardData([giroAcc], [])).toBeNull();
  });

  it('builds one view and no consolidated tab for a single account with data', () => {
    const d = buildDashboardData([giroAcc], giroTx)!;
    expect(d).not.toBeNull();
    expect(d.accounts).toHaveLength(1);
    expect(d.consolidated).toBeNull();
    expect(d.meta.n_accounts).toBe(1);
    const v = d.accounts[0];
    expect(v.role).toBe('giro');
    expect(v.label).toBe('Girokonto');
    expect(v.shared).toBe(false);
    expect(v.iban).toContain('…');
    expect(v.series).toHaveLength(12);
    expect(v.income).toBeCloseTo(3146.25, 2);
    expect(v.expenses).toBeCloseTo(582.82, 2);
    expect(v.cat_total['Kreditkarte (AMEX)']).toBeCloseTo(540.32, 2);
    expect(v.tx).toHaveLength(3);
  });

  it('builds one view per account plus a consolidated tab for 2+ accounts', () => {
    const d = buildDashboardData([giroAcc, jointAcc], [...giroTx, ...jointTx])!;
    expect(d.accounts).toHaveLength(2);
    expect(d.consolidated).not.toBeNull();
    const c = d.consolidated!;
    expect(c.accounts).toHaveLength(2);
    // household income = giro salary + joint Sina deposit
    expect(c.income).toBeCloseTo(3146.25 + 600, 2);
    // household expenses = giro consumption + joint Miete
    expect(c.expenses).toBeCloseTo(582.82 + 1200, 2);
    expect(c.cat_total['Miete']).toBeCloseTo(1200, 2);
    expect(c.cat_total['Kreditkarte (AMEX)']).toBeCloseTo(540.32, 2);
    expect(c.total_balance).toBeCloseTo((190908 + 213790) / 100, 2);
    expect(c.tx.length).toBe(giroTx.length + jointTx.length);
  });

  it('maps role from account_type / is_joint (independent of shared)', () => {
    const d = buildDashboardData([giroAcc, tagesAcc, jointAcc],
      [...giroTx, tx({ account_id: 't', booking_date: '2025-02-01', amount_cents: 100, category: 'Einnahmen · Zinsen' }), ...jointTx])!;
    const byId = Object.fromEntries(d.accounts.map((a) => [a.id, a]));
    expect(byId['g'].role).toBe('giro');
    expect(byId['t'].role).toBe('tages');
    expect(byId['j'].role).toBe('joint');
  });

  it('derives shared from member_count > 1, not is_joint', () => {
    // is_joint=true but only one member → not shared (badge source is now membership).
    const solo: Account = { ...jointAcc, member_count: 1 };
    expect(buildDashboardData([solo], jointTx)!.accounts[0].shared).toBe(false);

    // is_joint=false but two members → shared.
    const shared: Account = { ...giroAcc, member_count: 2 };
    expect(buildDashboardData([shared], giroTx)!.accounts[0].shared).toBe(true);

    // absent member_count → treated as 1 → not shared.
    expect(buildDashboardData([giroAcc], giroTx)!.accounts[0].shared).toBe(false);
  });

  it('uses display_name when set, otherwise the bank name', () => {
    const renamed: Account = { ...giroAcc, display_name: 'Mein Hauptkonto' };
    const d = buildDashboardData([renamed], giroTx)!;
    expect(d.accounts[0].label).toBe('Mein Hauptkonto');
  });

  it('renders an account with no categorised expenses without throwing', () => {
    const incomeOnly = [tx({ account_id: 'g', booking_date: '2025-01-31', amount_cents: 100000, category: 'Einnahmen · Gehalt' })];
    const d = buildDashboardData([giroAcc], incomeOnly)!;
    expect(d.accounts).toHaveLength(1);
    expect(Object.keys(d.accounts[0].cat_total)).toHaveLength(0);
    expect(d.accounts[0].expenses).toBeCloseTo(0, 2);
  });
});
