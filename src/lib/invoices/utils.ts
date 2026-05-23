export function roundToCents(value: number) {
  return Math.round(value * 100) / 100;
}

export function addDays(base: Date, days: number) {
  const copy = new Date(base);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}
