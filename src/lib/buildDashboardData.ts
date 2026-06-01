// Assembles the exact JSON shape that public/dashboard-view.js consumes:
// { m, b, tx, j, jx, c, cx } (see docs/DATA_SHAPE.md). All money is in EUR.
// The numeric heavy lifting lives in analytics.ts; this layer wires accounts and
// transactions together and shapes the account/series/summary/slim-list views.
import type { Account, Transaction } from './types';
import {
  markInternal, detectYear, accountSeries, giroSummary, detectSubs, buildBudget,
  personalMetrics, jointMetrics, consolidatedMetrics,
} from './analytics';

const maskIban = (iban: string | null): string =>
  iban && iban.length >= 8 ? `${iban.slice(0, 4)} … ${iban.slice(-4)}` : (iban ?? '');

const monthOf = (d: string) => d.slice(0, 7);

const KIND_OF_CATEGORY: Record<string, string> = {
  'Einnahmen · Zinsen': 'Zinsen',
  'Sparen (Tagesgeld-Einzahlung)': 'Sparen-Zufluss',
  'Entsparen (Tagesgeld-Auszahlung)': 'Entsparen-Abfluss',
};
const HARMONISE: Record<string, string> = { Gesundheit: 'Gesundheit & Freizeit' };
const KONSUM_CATS = new Set([
  'Wohnen & Haushalt','Kredite & Darlehen','Lebensmittel & Drogerie','Versicherungen',
  'Abos & Medien','Mobilität & Reise','Restaurants & Gastronomie','Gesundheit',
  'Shopping & Sonstiges','Kreditkarte (AMEX)','Bargeld','Spenden & Beiträge','Steuern & Gebühren',
]);

export function buildDashboardData(accounts: Account[], rawTxns: Transaction[]) {
  if (!accounts.length) return null;
  const txns = markInternal(rawTxns, accounts);
  const year = detectYear(txns.map((t) => t.booking_date));

  const roleOf = (a: Account): 'giro' | 'tages' | 'joint' =>
    a.is_joint || a.account_type === 'joint' ? 'joint' : a.account_type === 'savings' ? 'tages' : 'giro';
  const acctRole = new Map(accounts.map((a) => [a.id, roleOf(a)]));
  const byRole = (role: string) => txns.filter((t) => acctRole.get(t.account_id) === role);
  const giroTx = byRole('giro');
  const tagesTx = byRole('tages');
  const jointTx = byRole('joint');

  const giroAccs = accounts.filter((a) => roleOf(a) === 'giro');
  const tagesAccs = accounts.filter((a) => roleOf(a) === 'tages');
  const jointAcc = accounts.find((a) => roleOf(a) === 'joint') ?? null;
  const giroIban = giroAccs[0]?.iban ?? null;
  const jointIban = jointAcc?.iban ?? null;
  const sumBalance = (accs: Account[]) => accs.reduce((s, a) => s + (a.balance_cents ?? 0), 0);

  const pm = personalMetrics(giroTx, tagesTx, year);
  const giroSeries = accountSeries(giroTx, year, sumBalance(giroAccs));
  const tagesSeries = accountSeries(tagesTx, year, sumBalance(tagesAccs));

  const tagesTxnList = [...tagesTx]
    .sort((a, b) => a.booking_date.localeCompare(b.booking_date))
    .map((t) => ({
      d: t.booking_date, e: (t.counterparty ?? '').slice(0, 34), z: (t.purpose ?? '').slice(0, 46),
      a: t.amount_cents / 100, k: KIND_OF_CATEGORY[t.category ?? ''] ?? 'Sonstige',
    }));

  const m = {
    ...pm,
    n_total: giroTx.length + tagesTx.length,
    subs: detectSubs(giroTx),
    accounts: {
      giro: {
        name: giroAccs[0]?.name ?? 'Girokonto', iban: maskIban(giroIban),
        end2025: giroSeries.end, net: giroSeries.net, start2025: giroSeries.start,
        now: (sumBalance(giroAccs)) / 100, n: giroTx.length, series: giroSeries.series,
        summary: giroSummary(giroTx),
      },
      tages: {
        name: tagesAccs[0]?.name ?? 'Tagesgeldkonto', iban: maskIban(tagesAccs[0]?.iban ?? null),
        end2025: tagesSeries.end, net: tagesSeries.net, start2025: tagesSeries.start,
        now: (sumBalance(tagesAccs)) / 100, n: tagesTx.length, series: tagesSeries.series,
        zins: pm.zins_total, dep: pm.spar_tg_dep, wd: pm.tg_wd, txns: tagesTxnList,
      },
    },
  };

  const b = buildBudget(pm);

  const acctLabel = (id: string) => (acctRole.get(id) === 'tages' ? 'Tagesgeld' : 'Giro');
  const tx = [...giroTx, ...tagesTx].map((t) => ({
    acct: acctLabel(t.account_id), d: t.booking_date, mo: monthOf(t.booking_date),
    e: (t.counterparty ?? '').slice(0, 40), z: (t.purpose ?? '').slice(0, 90),
    a: t.amount_cents / 100, c: t.category ?? 'Shopping & Sonstiges', int: t.is_internal ? 1 : 0,
  }));

  const jm = jointMetrics(jointTx, year, sumBalance(jointAcc ? [jointAcc] : []));
  const { start, end, ...jmRest } = jm;
  const j = { ...jmRest, start2025: start, end2025: end };
  const jx = jointTx.map((t) => ({
    acct: 'Gemeinschaft', d: t.booking_date, mo: monthOf(t.booking_date),
    e: (t.counterparty ?? '').slice(0, 40), z: (t.purpose ?? '').slice(0, 90),
    a: t.amount_cents / 100, c: t.category ?? 'Shopping & Sonstiges', int: t.is_internal ? 1 : 0,
  }));

  const c = consolidatedMetrics({ giro: giroTx, joint: jointTx, jointIban, pm, jm, year });
  const cx: { src: string; d: string; mo: string; e: string; z: string; a: number; c: string }[] = [];
  for (const t of giroTx) {
    if (t.booking_date.slice(0, 4) !== String(year) || t.amount_cents >= 0) continue;
    if (jointIban && t.counterparty_iban === jointIban) continue;
    if (!KONSUM_CATS.has(t.category ?? '')) continue;
    cx.push({
      src: 'Hendrik', d: t.booking_date, mo: monthOf(t.booking_date),
      e: (t.counterparty ?? '').slice(0, 40), z: (t.purpose ?? '').slice(0, 90),
      a: t.amount_cents / 100, c: HARMONISE[t.category as string] ?? (t.category as string),
    });
  }
  for (const t of jointTx) {
    if (t.booking_date.slice(0, 4) !== String(year) || t.amount_cents >= 0) continue;
    cx.push({
      src: 'Gemeinschaft', d: t.booking_date, mo: monthOf(t.booking_date),
      e: (t.counterparty ?? '').slice(0, 40), z: (t.purpose ?? '').slice(0, 90),
      a: t.amount_cents / 100, c: t.category ?? 'Shopping & Sonstiges',
    });
  }

  return { m, b, tx, j, jx, c, cx };
}
