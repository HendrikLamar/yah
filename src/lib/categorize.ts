// Rule-based categorisation, ported from the Python prototype that built the
// original dashboard. Returns a {category, group} for each transaction.
//
// `group` drives the analytics:
//   Einnahmen | Konsum | Vermögen | Entsparen | Transfers | Intern | Einmalig
//
// Internal transfers (between the user's own accounts) are detected separately
// by comparing the counterparty IBAN to the set of the user's own IBANs.

export type Group =
  | 'Einnahmen' | 'Konsum' | 'Vermögen' | 'Entsparen'
  | 'Transfers' | 'Intern' | 'Einmalig';

export interface Classified { category: string; group: Group; }

export interface TxInput {
  counterparty: string;
  purpose: string;
  amountCents: number;     // negative = Ausgang
  isInternal?: boolean;    // counterparty IBAN is one of the user's own accounts
  ownerIsJoint?: boolean;  // account is the joint account (different rule set)
}

const has = (h: string, ...needles: string[]) => needles.some((n) => h.includes(n));

const FOOD = ['lidl','rewe','penny','norma','edeka','kaufland','aldi','tegut','alnatura','dm drogerie','dm.drogerie','rossmann','backerei','bäckerei','baeckerei','hofpfisterei','feinback','viani','go asia','nahversorg'];
const MOBILITY = ['tankstelle','shell','esso','total.service','classic','aral','jet ','star tankstelle','db.vertrieb','db vertrieb','db.fernverkehr','deutsche bahn','mvg','bvg','call.a.bike','lime','bolt.eu','bolt.eur','parkster','campingplatz','kfz-'];
const GASTRO = ['burger.king','burger king','mcdonald','osteria','bistro','gastronomie','hans.im.glueck','espresso','restaurant','schloss burger','cafe','braeu','gaststaette','haferkater','bullerjahn','bottles','rumpler'];
const ABOS = ['spotify','disney','netflix','frankfurter allgemeine','faz','spiegel','heise','tageblatt','tagebla','fraenk','bitwarden','hetzner','amazon media','amazon digital','kindle','audible','prime','fiverr','stickerapp'];
const HEALTH = ['apotheke','zahnarzt','praxis dr','hupach','fitness','kinderarzt','friseur','egym','wellpass','sport-club'];

export function classify(t: TxInput): Classified {
  const c = t.counterparty.toLowerCase();
  const z = t.purpose.toLowerCase();
  const full = `${c} ${z}`;
  const out = t.amountCents < 0;

  if (t.isInternal) return { category: 'Interner Transfer', group: 'Intern' };

  // ---- income ----
  if (!out) {
    if (has(z, 'lohn', 'gehalt')) return { category: 'Einnahmen · Gehalt', group: 'Einnahmen' };
    if (has(z, 'scalable')) return { category: 'Anlage-Auszahlung', group: 'Entsparen' };
    if (has(z, 'kapitalanlage', 'gesellschafterdarlehen', 'umbuchen', 'isfp'))
      return { category: 'Darlehen / Transfer', group: 'Transfers' };
    if (has(z, 'sf-b', 'sf-r', 'erstattung', 'tk-beleg', 'beitragserstattung', 'nachzahlung', 'zins'))
      return { category: 'Einnahmen · Erstattungen/Zinsen', group: 'Einnahmen' };
    return { category: 'Einnahmen · Sonstige', group: 'Einnahmen' };
  }

  // ---- one-off large purchases (joint: Wohnmobil etc.) ----
  if (has(full, 'wohnmobilkauf') || (t.ownerIsJoint && t.amountCents <= -500_000))
    return { category: 'Große Einmalposten', group: 'Einmalig' };

  // ---- household / joint specifics ----
  if (has(c, 'katharina katz') || (has(z, 'miete') && has(z, 'kepler')))
    return { category: 'Miete', group: 'Konsum' };
  if (has(c, 'kka goettingen', 'kka ')) return { category: 'Kita & Kinder', group: 'Konsum' };
  if (has(c, 'tieraerztlich', 'kleintierpraxis')) return { category: 'Haustier & Tierarzt', group: 'Konsum' };
  if (has(c, 'ewe vertrieb', 'vodafone', 'rundfunk')) return { category: 'Energie, Telekom & Rundfunk', group: 'Konsum' };

  // ---- savings / investments (personal) ----
  if (has(full, 'scalable') || has(c, 'huw invest') || has(z, 'kapitalrücklage', 'sparen'))
    return { category: 'Sparen & Investitionen', group: 'Vermögen' };

  // ---- consumption ----
  if (has(c, 'nurnberger', 'barmenia', 'envivas', 'baloise', 'versicherung', 'lebensvers'))
    return { category: 'Versicherungen', group: 'Konsum' };
  if (has(c, 'american express')) return { category: 'Kreditkarte (AMEX)', group: 'Konsum' };
  if (has(full, ...ABOS)) return { category: 'Abos & Medien', group: 'Konsum' };
  if (has(full, ...FOOD)) return { category: 'Lebensmittel & Drogerie', group: 'Konsum' };
  if (has(full, ...MOBILITY)) return { category: 'Mobilität & Reise', group: 'Konsum' };
  if (has(full, ...HEALTH)) return { category: 'Gesundheit & Freizeit', group: 'Konsum' };
  if (has(full, ...GASTRO)) return { category: 'Restaurants & Gastronomie', group: 'Konsum' };
  if (has(c, 'amnesty', 'wikimedia', 'sozialwerk', 'aenania')) return { category: 'Spenden & Beiträge', group: 'Konsum' };
  if (has(c, 'bundeskasse', 'stadtkasse', 'landkreis', 'dkb ag', 'toto')) return { category: 'Steuern & Gebühren', group: 'Konsum' };
  if (has(c, 'frido unseld', 'sina unseld', 'klaus-hagen', 'almuth')) return { category: 'Transfers / Privat', group: 'Transfers' };

  return { category: 'Shopping & Sonstiges', group: 'Konsum' };
}

// Apply user-defined override rules first, then fall back to classify().
export function classifyWithRules(
  t: TxInput,
  rules: { match_field: string; pattern: string; category: string; priority: number }[]
): Classified {
  if (t.isInternal) return { category: 'Interner Transfer', group: 'Intern' };
  const fields: Record<string, string> = { counterparty: t.counterparty, purpose: t.purpose };
  for (const r of [...rules].sort((a, b) => a.priority - b.priority)) {
    const hay = (fields[r.match_field] ?? '').toLowerCase();
    if (hay.includes(r.pattern.toLowerCase()))
      return { category: r.category, group: t.amountCents < 0 ? 'Konsum' : 'Einnahmen' };
  }
  return classify(t);
}
