import { formatIsoDate } from "@/lib/format";

export type DrillFilters = {
  from?: Date;
  to?: Date;
  counterparty?: string;
  category?: string;
  direction?: "INCOME" | "EXPENSE";
  includeTransfers?: boolean;
};

export function buildTransactionsDrillHref(filters: DrillFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", formatIsoDate(filters.from));
  if (filters.to) params.set("to", formatIsoDate(filters.to));
  if (filters.counterparty) params.set("counterparty", filters.counterparty);
  if (filters.category) params.set("category", filters.category);
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.includeTransfers === false) params.set("includeTransfers", "false");

  const qs = params.toString();
  return qs ? `/transactions?${qs}` : "/transactions";
}
