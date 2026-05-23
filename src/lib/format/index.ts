export const LOCALE = "de-DE";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
});

const numberFormatter = new Intl.NumberFormat(LOCALE);

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function formatDateRange(start: Date, end: Date): string {
  const startIso = formatIsoDate(start);
  const endIso = formatIsoDate(end);
  return startIso === endIso ? startIso : `${startIso} → ${endIso}`;
}

export function formatMaskedIban(ibanLast4: string | null): string {
  return ibanLast4 ? `····${ibanLast4}` : "—";
}
