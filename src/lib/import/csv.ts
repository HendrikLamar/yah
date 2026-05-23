export type ParsedCsvTransaction = {
  bookingDate: string;
  valueDate: string | null;
  counterpartyName: string | null;
  purposeRaw: string;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  currency: string;
};

const HEADER_ALIASES: Record<string, string[]> = {
  bookingDate: ["buchungstag", "buchungsdatum", "booking_date", "booking date", "date"],
  valueDate: ["wertstellung", "value_date", "value date"],
  counterpartyName: [
    "auftraggeber / begünstigter",
    "counterparty",
    "counterparty_name",
    "payee",
    "merchant",
    "name",
  ],
  payer: ["zahlungspflichtige*r", "zahlungspflichtiger", "zahlungspflichtige"],
  payee: ["zahlungsempfänger*in", "zahlungsempfaenger*in", "zahlungsempfänger", "zahlungsempfaenger"],
  purposeRaw: ["verwendungszweck", "purpose", "reference", "description", "memo"],
  amount: ["betrag (eur)", "betrag (€)", "betrag", "amount", "amount_eur"],
  currency: ["currency", "währung", "waehrung"],
};

export function parseTransactionCsv(input: string): ParsedCsvTransaction[] {
  const stripped = input.replace(/^﻿/, "");
  const trimmed = stripped.trim();

  if (!trimmed) {
    return [];
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headerLineIndex = findHeaderLineIndex(lines);

  if (headerLineIndex === -1) {
    throw new Error("CSV file is missing required columns for booking date and amount.");
  }

  const headerLine = lines[headerLineIndex];
  const separator = detectSeparator(headerLine);
  const headerCells = splitCsvLine(headerLine, separator).map(normalizeHeader);
  const bookingDateIndex = findColumnIndex(headerCells, "bookingDate");
  const amountIndex = findColumnIndex(headerCells, "amount");
  const valueDateIndex = findColumnIndex(headerCells, "valueDate");
  const counterpartyIndex = findColumnIndex(headerCells, "counterpartyName");
  const payerIndex = findColumnIndex(headerCells, "payer");
  const payeeIndex = findColumnIndex(headerCells, "payee");
  const purposeIndex = findColumnIndex(headerCells, "purposeRaw");
  const currencyIndex = findColumnIndex(headerCells, "currency");

  return lines.slice(headerLineIndex + 1).map((line) => {
    const cells = splitCsvLine(line, separator);
    const amount = parseAmount(cells[amountIndex] ?? "0", separator);
    const direction: "INCOME" | "EXPENSE" = amount < 0 ? "EXPENSE" : "INCOME";
    const directCounterparty =
      counterpartyIndex === -1 ? null : parseOptionalText(cells[counterpartyIndex]);
    const payer = payerIndex === -1 ? null : parseOptionalText(cells[payerIndex]);
    const payee = payeeIndex === -1 ? null : parseOptionalText(cells[payeeIndex]);
    const counterpartyName =
      directCounterparty ?? (direction === "EXPENSE" ? payee : payer);

    return {
      bookingDate: parseDate(cells[bookingDateIndex] ?? ""),
      valueDate: valueDateIndex === -1 ? null : parseDateOrNull(cells[valueDateIndex]),
      counterpartyName,
      purposeRaw:
        (purposeIndex === -1
          ? null
          : parseOptionalText(cells[purposeIndex])) ??
        counterpartyName ??
        "Imported CSV transaction",
      amount,
      direction,
      currency: parseOptionalText(currencyIndex === -1 ? undefined : cells[currencyIndex]) ?? "EUR",
    };
  });
}

function findHeaderLineIndex(lines: string[]): number {
  for (let index = 0; index < lines.length; index += 1) {
    const separator = detectSeparator(lines[index]);
    const cells = splitCsvLine(lines[index], separator).map(normalizeHeader);
    const hasBookingDate = findColumnIndex(cells, "bookingDate") !== -1;
    const hasAmount = findColumnIndex(cells, "amount") !== -1;

    if (hasBookingDate && hasAmount) {
      return index;
    }
  }

  return -1;
}

function detectSeparator(headerLine: string): string {
  const candidates = [";", ",", "\t"];
  const scored = candidates.map((separator) => ({
    separator,
    count: headerLine.split(separator).length,
  }));

  scored.sort((left, right) => right.count - left.count);

  return scored[0]?.count && scored[0].count > 1 ? scored[0].separator : ";";
}

function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const next = line[index + 1];

      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === separator && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current.trim());

  return cells;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function findColumnIndex(headers: string[], logicalName: keyof typeof HEADER_ALIASES): number {
  const aliases = HEADER_ALIASES[logicalName];

  return headers.findIndex((header) => aliases.includes(header));
}

function parseDate(value: string): string {
  const trimmed = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const fourDigitYear = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (fourDigitYear) {
    const [, day, month, year] = fourDigitYear;
    return `${year}-${month}-${day}`;
  }

  const twoDigitYear = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);

  if (twoDigitYear) {
    const [, day, month, year] = twoDigitYear;
    return `20${year}-${month}-${day}`;
  }

  throw new Error(`Unsupported date format: ${value}`);
}

function parseDateOrNull(value: string | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  return parseDate(value);
}

function parseAmount(value: string, separator?: string): number {
  const trimmed = value.trim();
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");

  let normalized = trimmed.replace(/[^0-9+,\-.]/g, "");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    normalized = normalized.replace(/,/g, ".");
  } else if (hasDot && separator === ";" && /^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    // German format with thousand separator only (e.g. "1.800" = 1800)
    normalized = normalized.replace(/\./g, "");
  }

  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    throw new Error(`Unsupported amount: ${value}`);
  }

  return parsed;
}

function parseOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
}
