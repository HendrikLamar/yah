// Parser for the classic DKB "Umsatzliste" CSV export (semicolon-delimited,
// German number format, a metadata block above the transaction table whose
// header row starts with "Buchungsdatum"). Mirrors the logic of the Python
// prototype in docs/python/ that produced the approved dashboard.

export interface DkbRow {
  bookingDate: string;            // ISO 'YYYY-MM-DD'
  payer: string;                  // Zahlungspflichtige*r / Auftraggeber (col 3)
  counterparty: string;           // Zahlungsempfänger*in / Empfänger (col 4)
  purpose: string;                // Verwendungszweck (col 5)
  type: string;                   // Umsatztyp: "Eingang" | "Ausgang" (col 6)
  amountCents: number;            // negative = outflow (col 8)
  counterpartyIban: string | null; // IBAN (col 7)
}

export interface DkbParseResult {
  iban: string | null;
  balanceCents: number | null;
  balanceDate: string | null;
  rows: DkbRow[];
}

// "1.234,56" -> 123456, "-1.000,00 EUR" -> -100000
export function parseGermanAmount(s: string): number {
  const cleaned = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) throw new Error(`Invalid German amount: ${JSON.stringify(s)}`);
  return Math.round(value * 100);
}

// "01.06.25" / "01.06.2026" -> "2026-06-01"
export function parseDkbDate(s: string): string {
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{2,4})$/);
  if (!m) throw new Error(`Invalid DKB date: ${JSON.stringify(s)}`);
  const [, dd, mm, yy] = m;
  const year = yy.length === 2 ? `20${yy}` : yy;
  return `${year}-${mm}-${dd}`;
}

const norm = (s: string) => s.trim().split(/\s+/).join(' ');

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ';' && !inQuotes) {
      fields.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

const IBAN_RE = /DE(?:\s?\d){20}/;

export function parseDkbCsv(content: string): DkbParseResult {
  const text = content.replace(/^﻿/, '');
  const lines = text.split(/\r?\n/);

  let iban: string | null = null;
  let balanceCents: number | null = null;
  let balanceDate: string | null = null;
  let headerIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('"Buchungsdatum"') || line.startsWith('Buchungsdatum')) {
      headerIdx = i;
      break;
    }
    if (!iban) {
      const m = line.match(IBAN_RE);
      if (m) iban = m[0].replace(/\s/g, '');
    }
    if (balanceCents === null && line.includes('Kontostand')) {
      const fields = splitCsvLine(line);
      const amountField = [...fields].reverse().find((f) => /\d,\d{2}/.test(f));
      if (amountField) balanceCents = parseGermanAmount(amountField);
      const d = line.match(/(\d{2}\.\d{2}\.\d{4})/);
      if (d) balanceDate = parseDkbDate(d[1]);
    }
  }

  const rows: DkbRow[] = [];
  if (headerIdx >= 0) {
    for (const line of lines.slice(headerIdx + 1)) {
      if (!line.trim()) continue;
      const f = splitCsvLine(line);
      if (f.length < 9) continue;
      let amountCents: number;
      try { amountCents = parseGermanAmount(f[8]); }
      catch { continue; }
      if (amountCents === 0) continue;
      const ibanField = f[7].trim();
      rows.push({
        bookingDate: parseDkbDate(f[0]),
        payer: norm(f[3]),
        counterparty: norm(f[4]),
        purpose: norm(f[5]),
        type: f[6].trim(),
        amountCents,
        counterpartyIban: IBAN_RE.test(ibanField) ? ibanField.replace(/\s/g, '') : null,
      });
    }
  }

  return { iban, balanceCents, balanceDate, rows };
}
