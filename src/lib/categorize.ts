// Rule-based categorisation, ported faithfully from the Python prototype that
// produced the approved dashboard (docs/python/metrics3.py = personal/Giro,
// docs/python/unify.py = Tagesgeld "kind", docs/python/joint.py = joint account).
//
// `group` drives the analytics:
//   Einnahmen | Konsum | Vermögen | Entsparen | Transfers | Intern | Einmalig
// (the prototype's "Bargeld" group is folded into Konsum so cash counts as
//  consumption, matching how the reference aggregates cat_total.)

export type Group =
  | 'Einnahmen' | 'Konsum' | 'Vermögen' | 'Entsparen'
  | 'Transfers' | 'Intern' | 'Einmalig';

export interface Classified { category: string; group: Group; }

const has = (h: string, ...needles: string[]) => needles.some((n) => h.includes(n));

// ---------------------------------------------------------------------------
// Personal / Girokonto
// ---------------------------------------------------------------------------
export interface PersonalInput {
  counterparty: string;
  purpose: string;
  amountCents: number;     // negative = Ausgang
  isInternal?: boolean;    // counterparty IBAN is one of the user's own accounts
}

const P_ABOS = ['spotify','disneyplus','disney','netflix','frankfurter allgemeine','faz','spiegel','heise','göttinger tageblatt','gottinger tageblatt','goettinger.tagebla','fraenk','bitwarden','hetzner','amazon media','amazon digital','kindle','audible','prime','fiverr','stickerapp'];
const P_FOOD = ['lidl','rewe','penny','norma','edeka','kaufland','aldi','dm.drogerie','dm drogerie','rossmann','backerei','baeckerei','hofpfisterei','feinbackerei','thiele','muehlenbaeck','viani','fausto kaffee','kr.nahvers','nahversorgung','yormas','bro.s.markt','fam..coop','amambiente','dtv.tabak'];
const P_MOB = ['tankstelle','classic.tank','shell','esso','total.service','aspit','brennero','trento','mantova','gavio','db.vertrieb','db vertrieb','db.fernverkehr','db.s','deutsche bahn','mvg','bvg','u4.vienna','call.a.bike','lime.fahrt','bolt.eu','bolt.eur','parkster','park.parchi','riverty.com.bvg','fahrzeugtechnik','weezevent','ticket.io','eventim','cinemaxx','hallenbad','naturerlebnisbad','knattercamping'];
const P_HEALTH = ['apotheke','zahnarzt','praxis dr','hupach','fitness.first'];
const P_GASTRO = ['burger.king','burger king','mcdonald','istanbull','bistro','gastronomie','hans.im.glueck','espresso.house','restfreizeit','htl.rest','kurdische.bistro','chili','chi.thu','quick.service','waldwirtschaft','zimtschnecken','bazis','olmo','pasticceria','manner','leboq','safkan','theil.gastro','storia','el.punto','la.baracchina','valcanover','gnp.calceran','so.pe.ti','fritz.berger.freizeit','sumup','espresso','kaffee','baracchina'];
const P_CASH = ['gaa','sb.ellieh','markt4.5.8','fischmarkt','indu.gaa','kaufland.goe','greismar','sparkasse.','volksbank.ks','deutsche.bank.ag/goet','.deutsche.bank'];
const P_DONATE = ['amnesty','wikimedia','mariana cannabis','philisterverein','gna ev','ipp-sozialwerk','sozialwerk','aenania','spc.wannda','dr..eckart'];
const P_TAX = ['bundeskasse','stadtkasse','stadt duderstadt','landkreis','georg-august-uni','dkb ag','toto-lotto','toto.lotto','gez','rundfunk'];

export function classifyPersonal(t: PersonalInput): Classified {
  const e = t.counterparty.toLowerCase();
  const z = t.purpose.toLowerCase();
  const full = `${e} | ${z}`;

  if (t.isInternal) return { category: 'Interner Transfer (Tagesgeld)', group: 'Intern' };

  // ---- income (any inflow) ----
  if (t.amountCents > 0) {
    if (has(z, 'lohn', 'gehalt')) return { category: 'Einnahmen · Gehalt', group: 'Einnahmen' };
    if (has(z, 'scalable')) return { category: 'Anlage-Auszahlung (Scalable)', group: 'Entsparen' };
    if (has(z, 'kapitalanlage', 'gesellschafterdarlehen', 'umbuch'))
      return { category: 'Darlehen / sonst. Transfer', group: 'Transfers' };
    return { category: 'Einnahmen · Erstattungen', group: 'Einnahmen' };
  }

  // ---- savings / investments ----
  if (has(full, 'scalable') || has(e, 'huw invest') || has(z, 'kapitalrücklage', 'scalable instant')
      || (has(e, 'herr hendrik windel') && has(z, 'sparen')))
    return { category: 'Sparen & Investitionen', group: 'Vermögen' };
  if (has(e, 'myotwin') && has(z, 'gesellschafterdarlehen'))
    return { category: 'Darlehen / sonst. Transfer', group: 'Transfers' };

  // ---- household specifics ----
  if (has(e, 'sina unseld')) {
    if (has(z, 'womo')) return { category: 'Shopping & Sonstiges', group: 'Konsum' };
    if (has(z, 'darl')) return { category: 'Kredite & Darlehen', group: 'Konsum' };
    return { category: 'Wohnen & Haushalt', group: 'Konsum' };
  }
  if (has(e, 'ewe vertrieb') || has(z, 'ewe vertrieb')) return { category: 'Wohnen & Haushalt', group: 'Konsum' };
  if (has(e, 'bundeskasse')) return { category: 'Kredite & Darlehen', group: 'Konsum' };

  // ---- consumption ----
  if (has(e, 'nurnberger leben', 'barmenia', 'envivas', 'versicherung', 'lebensvers'))
    return { category: 'Versicherungen', group: 'Konsum' };
  if (has(e, 'american express')) return { category: 'Kreditkarte (AMEX)', group: 'Konsum' };
  if (has(e, 'georg-august-uni') && has(z, 'sport')) return { category: 'Abos & Medien', group: 'Konsum' };
  if (has(full, ...P_ABOS)) return { category: 'Abos & Medien', group: 'Konsum' };
  if (has(full, ...P_FOOD)) return { category: 'Lebensmittel & Drogerie', group: 'Konsum' };
  if (has(full, ...P_MOB)) return { category: 'Mobilität & Reise', group: 'Konsum' };
  if (has(full, ...P_HEALTH)) return { category: 'Gesundheit', group: 'Konsum' };
  if (has(full, ...P_GASTRO)) return { category: 'Restaurants & Gastronomie', group: 'Konsum' };
  if (has(full, ...P_CASH)) return { category: 'Bargeld', group: 'Konsum' };
  if (has(full, ...P_DONATE)) return { category: 'Spenden & Beiträge', group: 'Konsum' };
  if (has(full, ...P_TAX)) return { category: 'Steuern & Gebühren', group: 'Konsum' };

  return { category: 'Shopping & Sonstiges', group: 'Konsum' };
}

// ---------------------------------------------------------------------------
// Tagesgeld (savings) — classified by "kind"
// ---------------------------------------------------------------------------
export type TagesgeldKind = 'Zinsen' | 'Sparen-Zufluss' | 'Entsparen-Abfluss' | 'Sonstige';

export interface TagesgeldInput {
  amountCents: number;
  counterpartyIban: string | null;
  counterparty: string;
  ownIbans: Set<string>;  // the user's own personal account IBANs
}

export function tagesgeldKind(t: TagesgeldInput): TagesgeldKind {
  const internal = !!t.counterpartyIban && t.ownIbans.has(t.counterpartyIban);
  if (internal) return t.amountCents > 0 ? 'Sparen-Zufluss' : 'Entsparen-Abfluss';
  if (t.amountCents > 0 && (t.counterparty.toLowerCase().startsWith('dkb') || !t.counterpartyIban))
    return 'Zinsen';
  return 'Sonstige';
}

export function classifyTagesgeld(kind: TagesgeldKind): Classified {
  switch (kind) {
    case 'Zinsen': return { category: 'Einnahmen · Zinsen', group: 'Einnahmen' };
    case 'Sparen-Zufluss': return { category: 'Sparen (Tagesgeld-Einzahlung)', group: 'Vermögen' };
    case 'Entsparen-Abfluss': return { category: 'Entsparen (Tagesgeld-Auszahlung)', group: 'Entsparen' };
    default: return { category: 'Sonstige', group: 'Transfers' };
  }
}

// ---------------------------------------------------------------------------
// Joint / Gemeinschaftskonto
// ---------------------------------------------------------------------------
export interface JointInput {
  counterparty: string;
  payer: string;
  purpose: string;
  amountCents: number;
  counterpartyIban: string | null;
  ownIbans: Set<string>;       // the user's own personal account IBANs
  partnerName?: string | null; // derived from the joint account owner_label
}

const J_FOOD = ['lidl','kaufland','dm drogerie','rossmann','rewe','edeka','penny','aldi','tegut','alnatura','viani','go asia','hofpfisterei','baeckerei','feinbaeckerei','chasmeisterei','norma','tania mohamed','incoop','goettingen 24','fausto'];
const J_HEALTH = ['apotheke','friseur','egym','wellpass','sport-club','stadtbibliothek','egapark','naturerlebnis'];
const J_MOB = ['tankstelle','star tankstelle','classic gottingen','aral','jet ','oil 2','hoyer','olv','kfz-','campingplatz','camping','db ','bahn'];
const J_GASTRO = ['osteria','braeu','gaststaette','cron u. lanz','cafe inti','restaurant','schloss burger','mcdonald','burger king','amavi','bullerjahn','bottles','dean david','haferkater','boyer','zum wenigemarkt','giesinger','rumpler','rice','chi '];
const J_TAX = ['bundeskasse','stadtkasse','dkb ag','schilderpraegerei stamer'];
const J_PRIVATE = ['frido unseld','sina unseld','hendrik windel','klaus-hagen hage','almuth sowa','marlies','keven kracht','vielen dank','insl/kyritz','weirauch'];
const J_SHOP = ['ikea','toom','deichmann','tchibo','thalia','soestrene','idee.creativ','butlers','gries deco','mcpaper','h+m','ernstings','hugendubel','nanu nana','covermade','galeria','fritz berger','buchhandlung','sonderp.baum','post ag','creativmarkt','schilder'];

export function classifyJoint(t: JointInput): Classified {
  const e = t.counterparty.toLowerCase();
  const z = t.purpose.toLowerCase();
  const payer = t.payer.toLowerCase();
  const full = `${e} ${z}`;

  // ---- inflows: attribute to owner / partner / external ----
  if (t.amountCents > 0) {
    if (t.counterpartyIban && t.ownIbans.has(t.counterpartyIban))
      return { category: 'Einzahlung · Hendrik', group: 'Einnahmen' };
    const partner = (t.partnerName ?? '').toLowerCase();
    if (partner && (payer.includes(partner) || e.includes(partner)))
      return { category: 'Einzahlung · Sina', group: 'Einnahmen' };
    return { category: 'Erstattung / extern', group: 'Einnahmen' };
  }

  // ---- expenses ----
  if (has(e, 'kathrin schneider') || has(z, 'wohnmobilkauf'))
    return { category: 'Große Einmalposten', group: 'Einmalig' };
  if (has(e, 'katharina katz') || (has(z, 'miete') && has(z, 'kepler')))
    return { category: 'Miete', group: 'Konsum' };
  if (has(e, 'kka goettingen', 'kka', 'kinderarzt')) return { category: 'Kita & Kinder', group: 'Konsum' };
  if (has(e, 'tieraerztlich', 'kleintierpraxis', 'drachenladen'))
    return { category: 'Haustier & Tierarzt', group: 'Konsum' };
  if (has(e, 'baloise')) return { category: 'Versicherungen', group: 'Konsum' };
  if (has(e, 'ewe vertrieb', 'vodafone', 'rundfunk ard'))
    return { category: 'Energie, Telekom & Rundfunk', group: 'Konsum' };
  if (has(full, ...J_FOOD)) return { category: 'Lebensmittel & Drogerie', group: 'Konsum' };
  if (has(full, ...J_HEALTH)) return { category: 'Gesundheit & Freizeit', group: 'Konsum' };
  if (has(full, ...J_MOB)) return { category: 'Mobilität & Reise', group: 'Konsum' };
  if (has(full, ...J_GASTRO)) return { category: 'Restaurants & Gastronomie', group: 'Konsum' };
  if (has(e, ...J_TAX)) return { category: 'Steuern & Gebühren', group: 'Konsum' };
  if (has(e, ...J_PRIVATE)) return { category: 'Transfers / Privat', group: 'Transfers' };
  if (has(full, ...J_SHOP)) return { category: 'Shopping & Sonstiges', group: 'Konsum' };
  return { category: 'Shopping & Sonstiges', group: 'Konsum' };
}

// ---------------------------------------------------------------------------
// User-defined overrides on top of the personal engine
// ---------------------------------------------------------------------------
export function classifyWithRules(
  t: PersonalInput,
  rules: { match_field: string; pattern: string; category: string; priority: number }[],
): Classified {
  if (t.isInternal) return { category: 'Interner Transfer (Tagesgeld)', group: 'Intern' };
  const fields: Record<string, string> = { counterparty: t.counterparty, purpose: t.purpose };
  for (const r of [...rules].sort((a, b) => a.priority - b.priority)) {
    const hay = (fields[r.match_field] ?? '').toLowerCase();
    if (hay.includes(r.pattern.toLowerCase()))
      return { category: r.category, group: t.amountCents < 0 ? 'Konsum' : 'Einnahmen' };
  }
  return classifyPersonal(t);
}
