import { describe, it, expect } from 'vitest';
import {
  classifyPersonal,
  classifyTagesgeld,
  tagesgeldKind,
  classifyJoint,
  classifyWithRules,
} from '../categorize';

const personal = (counterparty: string, purpose: string, amountCents: number, isInternal = false) =>
  classifyPersonal({ counterparty, purpose, amountCents, isInternal });

describe('classifyPersonal (Giro)', () => {
  it('detects salary from the purpose', () => {
    expect(personal('', 'Lohn/Gehalt 01/25', 314625)).toEqual({
      category: 'Einnahmen · Gehalt', group: 'Einnahmen',
    });
  });
  it('detects reimbursements/refunds as income', () => {
    expect(personal('Techniker Krankenkasse', 'Beitragserstattung', 20912).group).toBe('Einnahmen');
  });
  it('flags internal transfers regardless of text', () => {
    expect(personal('Eigenuebertrag', 'Umbuchung', -50000, true)).toEqual({
      category: 'Interner Transfer (Tagesgeld)', group: 'Intern',
    });
  });
  it('classifies Scalable outflow as savings (Vermögen)', () => {
    expect(personal('Scalable Capital', 'Sparplan', -50000)).toEqual({
      category: 'Sparen & Investitionen', group: 'Vermögen',
    });
  });
  it('classifies Scalable inflow as a divestment (Entsparen)', () => {
    expect(personal('', 'Scalable Auszahlung', 100000)).toEqual({
      category: 'Anlage-Auszahlung (Scalable)', group: 'Entsparen',
    });
  });
  it('maps groceries to Lebensmittel & Drogerie / Konsum', () => {
    expect(personal('REWE SAGT DANKE', 'Einkauf', -4250)).toEqual({
      category: 'Lebensmittel & Drogerie', group: 'Konsum',
    });
  });
  it('maps AMEX to its own consumption category', () => {
    expect(personal('American Express', 'Abrechnung', -54032).category).toBe('Kreditkarte (AMEX)');
  });
  it('maps energy provider to Wohnen & Haushalt', () => {
    expect(personal('EWE Vertrieb GmbH', 'Strom', -8000).category).toBe('Wohnen & Haushalt');
  });
  it('maps insurers to Versicherungen', () => {
    expect(personal('Barmenia Versicherung', 'Beitrag', -9000).category).toBe('Versicherungen');
  });
  it('treats cash withdrawals as the Bargeld category in the Konsum group', () => {
    const c = personal('Sparkasse.Goettingen', 'Bargeldauszahlung', -20000);
    expect(c.category).toBe('Bargeld');
    expect(c.group).toBe('Konsum');
  });
  it('falls back to Shopping & Sonstiges for unknown spend', () => {
    expect(personal('Irgendein Laden', 'etwas', -1999)).toEqual({
      category: 'Shopping & Sonstiges', group: 'Konsum',
    });
  });
});

describe('Tagesgeld classification by kind', () => {
  const own = new Set(['DE62120300001021068935', 'DE30120300001030293144']);
  it('detects interest: positive, not internal, from the bank', () => {
    expect(tagesgeldKind({ amountCents: 523, counterpartyIban: null, counterparty: 'DKB AG', ownIbans: own }))
      .toBe('Zinsen');
  });
  it('detects a deposit: internal inflow', () => {
    expect(tagesgeldKind({ amountCents: 50000, counterpartyIban: 'DE30120300001030293144', counterparty: '', ownIbans: own }))
      .toBe('Sparen-Zufluss');
  });
  it('detects a withdrawal: internal outflow', () => {
    expect(tagesgeldKind({ amountCents: -30000, counterpartyIban: 'DE30120300001030293144', counterparty: '', ownIbans: own }))
      .toBe('Entsparen-Abfluss');
  });
  it('maps each kind to the right category/group', () => {
    expect(classifyTagesgeld('Zinsen')).toEqual({ category: 'Einnahmen · Zinsen', group: 'Einnahmen' });
    expect(classifyTagesgeld('Sparen-Zufluss')).toEqual({ category: 'Sparen (Tagesgeld-Einzahlung)', group: 'Vermögen' });
    expect(classifyTagesgeld('Entsparen-Abfluss')).toEqual({ category: 'Entsparen (Tagesgeld-Auszahlung)', group: 'Entsparen' });
  });
});

describe('classifyJoint (Gemeinschaftskonto)', () => {
  const ownIbans = new Set(['DE30120300001030293144', 'DE62120300001021068935']);
  const joint = (o: Partial<Parameters<typeof classifyJoint>[0]>) =>
    classifyJoint({ counterparty: '', payer: '', purpose: '', amountCents: 0, counterpartyIban: null, ownIbans, partnerName: 'Sina', ...o });

  it('attributes an inflow from an own account to the owner (Hendrik)', () => {
    expect(joint({ amountCents: 80000, counterpartyIban: 'DE30120300001030293144' })).toEqual({
      category: 'Einzahlung · Hendrik', group: 'Einnahmen',
    });
  });
  it('attributes a named partner inflow to the partner (Sina)', () => {
    expect(joint({ amountCents: 60000, payer: 'Sina Unseld' })).toEqual({
      category: 'Einzahlung · Sina', group: 'Einnahmen',
    });
  });
  it('treats other inflows as external', () => {
    expect(joint({ amountCents: 5000, payer: 'Finanzamt' })).toEqual({
      category: 'Erstattung / extern', group: 'Einnahmen',
    });
  });
  it('flags a big one-off purchase as Große Einmalposten', () => {
    expect(joint({ amountCents: -2000000, purpose: 'Wohnmobilkauf' })).toEqual({
      category: 'Große Einmalposten', group: 'Einmalig',
    });
  });
  it('detects rent', () => {
    expect(joint({ amountCents: -120000, counterparty: 'Katharina Katz' }).category).toBe('Miete');
  });
  it('detects childcare', () => {
    expect(joint({ amountCents: -25000, counterparty: 'KKA Goettingen' }).category).toBe('Kita & Kinder');
  });
  it('falls back to Shopping & Sonstiges', () => {
    expect(joint({ amountCents: -3000, counterparty: 'Unbekannt' })).toEqual({
      category: 'Shopping & Sonstiges', group: 'Konsum',
    });
  });
});

describe('classifyWithRules (user overrides on personal)', () => {
  it('applies a matching user rule before the default engine', () => {
    const res = classifyWithRules(
      { counterparty: 'REWE SAGT DANKE', purpose: 'Einkauf', amountCents: -4250 },
      [{ match_field: 'counterparty', pattern: 'rewe', category: 'Mein Supermarkt', priority: 1 }],
    );
    expect(res.category).toBe('Mein Supermarkt');
  });
  it('falls back to the default engine when no rule matches', () => {
    const res = classifyWithRules(
      { counterparty: 'REWE SAGT DANKE', purpose: 'Einkauf', amountCents: -4250 },
      [],
    );
    expect(res.category).toBe('Lebensmittel & Drogerie');
  });
});
