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
  bookingDate: ["buchungstag", "booking_date", "booking date", "date"],
  valueDate: ["wertstellung", "value_date", "value date"],
  counterpartyName: [
    "auftraggeber / begünstigter",
    "counterparty",
    "counterparty_name",
    "payee",
    "merchant",
    "name",
  ],
  purposeRaw: ["verwendungszweck", "purpose", "reference", "description", "memo"],
  amount: ["betrag (eur)", "betrag", "amount", "amount_eur"],
  currency: ["currency", "währung", "waehrung"],
};

export function parseTransactionCsv(input: string): ParsedCsvTransaction[] {
  const trimmed = input.trim();

  if (!trimmed) {
    return [];
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const separator = detectSeparator(lines[0]);
  const headerCells = splitCsvLine(lines[0], separator).map(normalizeHeader);
  const requiredColumns = {
    bookingDate: findColumnIndex(headerCells, "bookingDate"),
    amount: findColumnIndex(headerCells, "amount"),
  };

  if (requiredColumns.bookingDate === -1 || requiredColumns.amount === -1) {
    throw new Error("CSV file is missing required columns for booking date and amount.");
  }

  const bookingDateIndex = requiredColumns.bookingDate;
  const amountIndex = requiredColumns.amount;
  const valueDateIndex = findColumnIndex(headerCells, "valueDate");
  const counterpartyIndex = findColumnIndex(headerCells, "counterpartyName");
  const purposeIndex = findColumnIndex(headerCells, "purposeRaw");
  const currencyIndex = findColumnIndex(headerCells, "currency");

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, separator);
    const amount = parseAmount(cells[amountIndex] ?? "0");

    return {
      bookingDate: parseDate(cells[bookingDateIndex] ?? ""),
      valueDate: valueDateIndex === -1 ? null : parseDateOrNull(cells[valueDateIndex]),
      counterpartyName: counterpartyIndex === -1 ? null : parseOptionalText(cells[counterpartyIndex]),
      purposeRaw:
        purposeIndex === -1
          ? parseOptionalText(cells[counterpartyIndex]) ?? "Imported CSV transaction"
          : parseOptionalText(cells[purposeIndex]) ?? "Imported CSV transaction",
      amount,
      direction: amount < 0 ? "EXPENSE" : "INCOME",
      currency: parseOptionalText(currencyIndex === -1 ? undefined : cells[currencyIndex]) ?? "EUR",
    };
  });
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

  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (!match) {
    throw new Error(`Unsupported date format: ${value}`);
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseDateOrNull(value: string | undefined): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  return parseDate(value);
}

function parseAmount(value: string): number {
  const trimmed = value.trim();
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");

  let normalized = trimmed.replace(/[^0-9+,\-.]/g, "");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    normalized = normalized.replace(/,/g, ".");
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
