import type { Prisma } from "@prisma/client";

export type Direction = "INCOME" | "EXPENSE";
export type Responsibility = "SHARED" | "USER";
export type ViewKind = "list" | "byCounterparty" | "byCategory" | "byMonth" | "byAccount";

export type SortKey =
  | "bookingDate"
  | "valueDate"
  | "amount"
  | "amountAbs"
  | "counterpartyName"
  | "purposeRaw"
  | "account"
  | "category"
  | "responsibility"
  | "createdAt";

export type SortDirection = "asc" | "desc";

export type SortSpec = {
  key: SortKey;
  direction: SortDirection;
};

export type SearchFilters = {
  freeText: string[];
  quotedPhrases: string[];
  counterparty: string[];
  category: string[];
  account: string[];
  direction: Direction | null;
  responsibility: Responsibility | null;
  transferOnly: boolean | null;
  includeTransfers: boolean;
  from: Date | null;
  to: Date | null;
  minAmount: number | null;
  maxAmount: number | null;
  sort: SortSpec | null;
};

const SORT_KEYS: readonly SortKey[] = [
  "bookingDate",
  "valueDate",
  "amount",
  "amountAbs",
  "counterpartyName",
  "purposeRaw",
  "account",
  "category",
  "responsibility",
  "createdAt",
] as const;

const SORT_KEY_SET = new Set<string>(SORT_KEYS);

export function emptyFilters(): SearchFilters {
  return {
    freeText: [],
    quotedPhrases: [],
    counterparty: [],
    category: [],
    account: [],
    direction: null,
    responsibility: null,
    transferOnly: null,
    includeTransfers: false,
    from: null,
    to: null,
    minAmount: null,
    maxAmount: null,
    sort: null,
  };
}

export function parseSearchInput(input: string): SearchFilters {
  const filters = emptyFilters();
  if (!input || !input.trim()) return filters;

  for (const token of tokenize(input)) {
    if (token.kind === "quoted") {
      filters.quotedPhrases.push(token.value);
      continue;
    }
    const raw = token.value;
    const colonIdx = raw.indexOf(":");
    const opPrefix = raw.match(/^(amount[<>=])(.*)$/);
    if (opPrefix) {
      applyAmountOp(filters, opPrefix[1], opPrefix[2]);
      continue;
    }
    if (colonIdx > 0) {
      const op = raw.slice(0, colonIdx).toLowerCase();
      const value = raw.slice(colonIdx + 1);
      if (applyOperator(filters, op, value)) continue;
    }
    filters.freeText.push(raw);
  }

  return filters;
}

export function parseUrlSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): SearchFilters {
  const getAll = (key: string): string[] => {
    if (params instanceof URLSearchParams) return params.getAll(key);
    const v = params[key];
    if (v === undefined) return [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [v];
  };
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const v = params[key];
    if (v === undefined) return undefined;
    return Array.isArray(v) ? v[0] : v;
  };

  const fromInput = parseSearchInput(get("q") ?? "");

  const from = parseIsoDate(get("from")) ?? fromInput.from;
  const to = parseIsoDate(get("to")) ?? fromInput.to;

  const direction = parseDirection(get("direction")) ?? fromInput.direction;
  const responsibility = parseResponsibility(get("responsibility")) ?? fromInput.responsibility;

  const minAmount = parseNumber(get("minAmount")) ?? fromInput.minAmount;
  const maxAmount = parseNumber(get("maxAmount")) ?? fromInput.maxAmount;

  const includeTransfersParam = get("includeTransfers");
  const includeTransfers = includeTransfersParam === undefined
    ? fromInput.includeTransfers
    : includeTransfersParam === "true";

  const transferOnly = parseBoolean(get("transfer")) ?? fromInput.transferOnly;

  const counterpartyParam = getAll("counterparty");
  const categoryParam = getAll("category");
  const accountParam = getAll("account");

  const sort = parseSortSpec(get("sort")) ?? fromInput.sort;

  return {
    freeText: fromInput.freeText,
    quotedPhrases: fromInput.quotedPhrases,
    counterparty: [...fromInput.counterparty, ...counterpartyParam],
    category: [...fromInput.category, ...categoryParam],
    account: [...fromInput.account, ...accountParam],
    direction,
    responsibility,
    transferOnly,
    includeTransfers,
    from,
    to,
    minAmount,
    maxAmount,
    sort,
  };
}

export function serializeFiltersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  const qParts: string[] = [];
  for (const t of filters.freeText) qParts.push(t);
  for (const p of filters.quotedPhrases) qParts.push(`"${p}"`);
  if (qParts.length) params.set("q", qParts.join(" "));
  if (filters.from) params.set("from", filters.from.toISOString().slice(0, 10));
  if (filters.to) params.set("to", filters.to.toISOString().slice(0, 10));
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.responsibility) params.set("responsibility", filters.responsibility);
  if (filters.minAmount !== null) params.set("minAmount", String(filters.minAmount));
  if (filters.maxAmount !== null) params.set("maxAmount", String(filters.maxAmount));
  if (filters.includeTransfers) params.set("includeTransfers", "true");
  if (filters.transferOnly === true) params.set("transfer", "true");
  for (const c of filters.counterparty) params.append("counterparty", c);
  for (const c of filters.category) params.append("category", c);
  for (const a of filters.account) params.append("account", a);
  if (filters.sort) {
    params.set("sort", `${filters.sort.key}.${filters.sort.direction}`);
  }
  return params;
}

type Token = { kind: "bare" | "quoted"; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === " " || ch === "\t" || ch === "\n") {
      i++;
      continue;
    }
    if (ch === '"') {
      const close = input.indexOf('"', i + 1);
      if (close === -1) {
        tokens.push({ kind: "quoted", value: input.slice(i + 1) });
        break;
      }
      tokens.push({ kind: "quoted", value: input.slice(i + 1, close) });
      i = close + 1;
      continue;
    }
    let end = i;
    while (end < input.length && input[end] !== " " && input[end] !== "\t" && input[end] !== "\n") {
      end++;
    }
    const value = input.slice(i, end);
    if (value.length > 0) tokens.push({ kind: "bare", value });
    i = end;
  }
  return tokens;
}

function applyAmountOp(filters: SearchFilters, op: string, value: string): void {
  const num = parseNumber(value);
  if (num === null) return;
  if (op === "amount>") filters.minAmount = num;
  else if (op === "amount<") filters.maxAmount = num;
  else if (op === "amount=") {
    filters.minAmount = num;
    filters.maxAmount = num;
  }
}

function applyOperator(filters: SearchFilters, op: string, value: string): boolean {
  if (!value) return false;
  switch (op) {
    case "from": {
      const d = parseIsoDate(value);
      if (d) filters.from = d;
      return true;
    }
    case "to": {
      const d = parseIsoDate(value);
      if (d) filters.to = endOfDay(d);
      return true;
    }
    case "month": {
      const m = value.match(/^(\d{4})-(\d{2})$/);
      if (!m) return true;
      const year = Number(m[1]);
      const monthIdx = Number(m[2]) - 1;
      filters.from = new Date(Date.UTC(year, monthIdx, 1));
      filters.to = new Date(Date.UTC(year, monthIdx + 1, 0, 23, 59, 59, 999));
      return true;
    }
    case "year": {
      const m = value.match(/^(\d{4})$/);
      if (!m) return true;
      const year = Number(m[1]);
      filters.from = new Date(Date.UTC(year, 0, 1));
      filters.to = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      return true;
    }
    case "category":
      filters.category.push(value);
      return true;
    case "account":
      filters.account.push(value);
      return true;
    case "counterparty":
      filters.counterparty.push(value);
      return true;
    case "direction": {
      const d = parseDirection(value);
      if (d) filters.direction = d;
      return true;
    }
    case "transfer": {
      const b = parseBoolean(value);
      if (b !== null) filters.transferOnly = b;
      return true;
    }
    case "responsibility": {
      const r = parseResponsibility(value);
      if (r) filters.responsibility = r;
      return true;
    }
    case "sort": {
      const spec = parseSortSpec(value);
      if (spec) filters.sort = spec;
      return true;
    }
  }
  return false;
}

function parseIsoDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function endOfDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
}

function parseDirection(value: string | undefined | null): Direction | null {
  if (!value) return null;
  const v = value.toUpperCase();
  return v === "INCOME" || v === "EXPENSE" ? (v as Direction) : null;
}

function parseResponsibility(value: string | undefined | null): Responsibility | null {
  if (!value) return null;
  const v = value.toUpperCase();
  return v === "SHARED" || v === "USER" ? (v as Responsibility) : null;
}

function parseBoolean(value: string | undefined | null): boolean | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return null;
}

function parseNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const trimmed = value.trim().replace(",", ".");
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export function parseSortSpec(value: string | undefined | null): SortSpec | null {
  if (!value) return null;
  const [key, dir] = value.split(".");
  if (!key || !SORT_KEY_SET.has(key)) return null;
  const direction: SortDirection = dir === "asc" ? "asc" : "desc";
  return { key: key as SortKey, direction };
}

export function defaultSort(filters: SearchFilters): SortSpec {
  if (filters.sort) return filters.sort;
  if (filters.minAmount !== null || filters.maxAmount !== null) {
    return { key: "amountAbs", direction: "desc" };
  }
  return { key: "bookingDate", direction: "desc" };
}

type ViewerLike = { userId: string } | null | undefined;

export function buildTransactionWhere(
  filters: SearchFilters,
  visibility: Prisma.TransactionWhereInput,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { ...visibility };
  const and: Prisma.TransactionWhereInput[] = [];

  if (filters.from) and.push({ bookingDate: { gte: filters.from } });
  if (filters.to) and.push({ bookingDate: { lte: filters.to } });
  if (filters.direction) and.push({ direction: filters.direction });
  if (filters.responsibility) and.push({ responsibilityType: filters.responsibility });
  if (filters.transferOnly !== null) and.push({ isInternalTransfer: filters.transferOnly });
  else if (!filters.includeTransfers) and.push({ isInternalTransfer: false });

  if (filters.minAmount !== null || filters.maxAmount !== null) {
    const absConds: Prisma.TransactionWhereInput[] = [];
    if (filters.minAmount !== null) {
      absConds.push({
        OR: [
          { amount: { gte: filters.minAmount } },
          { amount: { lte: -filters.minAmount } },
        ],
      });
    }
    if (filters.maxAmount !== null) {
      absConds.push({
        AND: [
          { amount: { lte: filters.maxAmount } },
          { amount: { gte: -filters.maxAmount } },
        ],
      });
    }
    and.push(...absConds);
  }

  if (filters.counterparty.length) {
    and.push({
      OR: filters.counterparty.map((c) => ({
        counterpartyName: { contains: c, mode: "insensitive" as const },
      })),
    });
  }

  if (filters.account.length) {
    and.push({
      OR: filters.account.map((a) => ({
        account: { name: { contains: a, mode: "insensitive" as const } },
      })),
    });
  }

  if (filters.category.length) {
    and.push({
      OR: filters.category.map((c) => ({
        OR: [
          { category: { slug: { equals: c.toLowerCase() } } },
          { category: { name: { contains: c, mode: "insensitive" as const } } },
        ],
      })),
    });
  }

  for (const term of filters.freeText) {
    and.push({
      OR: [
        { purposeRaw: { contains: term, mode: "insensitive" } },
        { counterpartyName: { contains: term, mode: "insensitive" } },
        { normalizedMerchant: { contains: term, mode: "insensitive" } },
      ],
    });
  }

  for (const phrase of filters.quotedPhrases) {
    and.push({
      OR: [
        { purposeRaw: { contains: phrase, mode: "insensitive" } },
        { counterpartyName: { contains: phrase, mode: "insensitive" } },
        { normalizedMerchant: { contains: phrase, mode: "insensitive" } },
      ],
    });
  }

  if (and.length) where.AND = and;
  return where;
}

export function buildTransactionOrderBy(
  spec: SortSpec,
): Prisma.TransactionOrderByWithRelationInput[] {
  const stableTiebreaker: Prisma.TransactionOrderByWithRelationInput = { id: spec.direction };
  switch (spec.key) {
    case "bookingDate":
      return [{ bookingDate: spec.direction }, stableTiebreaker];
    case "valueDate":
      return [{ valueDate: spec.direction }, stableTiebreaker];
    case "amount":
      return [{ amount: spec.direction }, stableTiebreaker];
    case "amountAbs":
      // Pure orderBy can't express ABS(amount); the search layer falls back
      // to a raw-SQL path for this key. We still need a deterministic order
      // for callers that ignore the raw path (e.g. tests / aggregates).
      return [{ amount: spec.direction }, stableTiebreaker];
    case "counterpartyName":
      return [{ counterpartyName: spec.direction }, stableTiebreaker];
    case "purposeRaw":
      return [{ purposeRaw: spec.direction }, stableTiebreaker];
    case "account":
      return [{ account: { name: spec.direction } }, stableTiebreaker];
    case "category":
      return [{ category: { name: spec.direction } }, stableTiebreaker];
    case "responsibility":
      return [{ responsibilityType: spec.direction }, stableTiebreaker];
    case "createdAt":
      return [{ createdAt: spec.direction }, stableTiebreaker];
  }
}

export type SearchPagination = {
  page: number;
  pageSize: number;
};

export const DEFAULT_PAGE_SIZE = 50;

export function parsePagination(
  raw: string | undefined,
  pageSize: number = DEFAULT_PAGE_SIZE,
): SearchPagination {
  const page = Math.max(1, Math.floor(Number(raw ?? "1")));
  return { page: Number.isFinite(page) && page > 0 ? page : 1, pageSize };
}

// Keep ViewerLike export for future use; unused here.
export type { ViewerLike };
