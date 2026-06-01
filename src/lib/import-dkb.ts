// Pure mapping from parsed DKB CSV rows to classified transaction payloads,
// ready to upsert. Classification depends on the account's role:
//   giro    -> classifyWithRules / classifyPersonal
//   savings -> tagesgeldKind -> classifyTagesgeld
//   joint   -> classifyJoint (partner name attributes the partner's deposits)
// Dedup key is a deterministic content hash (no provider id for CSV imports).
import type { DkbRow } from './dkb-csv';
import {
  classifyPersonal, classifyWithRules, classifyJoint,
  tagesgeldKind, classifyTagesgeld,
} from './categorize';

export type AccountRole = 'giro' | 'savings' | 'joint';

export interface ImportRow {
  booking_date: string;
  amount_cents: number;
  currency: string;
  counterparty: string;
  purpose: string;
  counterparty_iban: string | null;
  category: string;
  category_group: string;
  is_internal: boolean;
  gc_transaction_id: string;
}

export interface UserRule { match_field: string; pattern: string; category: string; priority: number; }

// Two independent rolling hashes over the stable identifying fields, combined
// into a ~64-bit base36 key to keep accidental cross-content collisions
// negligible. CSV imports have no provider id, so this is the dedup key.
export function contentHash(r: DkbRow): string {
  const key = [r.bookingDate, r.amountCents, r.counterparty, r.purpose, r.counterpartyIban ?? ''].join('|');
  let h1 = 5381;   // djb2
  let h2 = 0x811c9dc5; // fnv-1a
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = (((h1 << 5) + h1) ^ c) >>> 0;
    h2 = ((h2 ^ c) * 0x01000193) >>> 0;
  }
  return `csv_${h1.toString(36)}${h2.toString(36)}`;
}

export function buildImportRows(args: {
  rows: DkbRow[];
  accountRole: AccountRole;
  ownIbans: Set<string>;
  partnerName?: string | null;
  rules?: UserRule[];
}): ImportRow[] {
  const { rows, accountRole, ownIbans, partnerName = null, rules = [] } = args;

  // Identical same-day rows share a content hash; an occurrence suffix keeps
  // them distinct while staying idempotent when the same file is re-imported.
  const seen = new Map<string, number>();

  return rows.map((r) => {
    const isInternal = !!r.counterpartyIban && ownIbans.has(r.counterpartyIban);
    let category: string;
    let group: string;

    if (accountRole === 'savings') {
      const kind = tagesgeldKind({
        amountCents: r.amountCents, counterpartyIban: r.counterpartyIban,
        counterparty: r.counterparty, ownIbans,
      });
      ({ category, group } = classifyTagesgeld(kind));
    } else if (accountRole === 'joint') {
      ({ category, group } = classifyJoint({
        counterparty: r.counterparty, payer: r.payer, purpose: r.purpose,
        amountCents: r.amountCents, counterpartyIban: r.counterpartyIban, ownIbans, partnerName,
      }));
    } else {
      const input = { counterparty: r.counterparty, purpose: r.purpose, amountCents: r.amountCents, isInternal };
      ({ category, group } = rules.length ? classifyWithRules(input, rules) : classifyPersonal(input));
    }

    const base = contentHash(r);
    const occ = seen.get(base) ?? 0;
    seen.set(base, occ + 1);

    return {
      booking_date: r.bookingDate,
      amount_cents: r.amountCents,
      currency: 'EUR',
      counterparty: r.counterparty,
      purpose: r.purpose,
      counterparty_iban: r.counterpartyIban,
      category,
      category_group: group,
      is_internal: isInternal,
      gc_transaction_id: occ === 0 ? base : `${base}_${occ}`,
    };
  });
}
