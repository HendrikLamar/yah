import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

import {
  buildTransactionOrderBy,
  buildTransactionWhere,
  DEFAULT_PAGE_SIZE,
  defaultSort,
  type SearchFilters,
  type SearchPagination,
  type SortSpec,
} from "./transaction-search";

export type SearchSummary = {
  count: number;
  incomeTotal: number;
  expenseTotal: number;
  net: number;
};

export type SearchResultRow = {
  id: string;
  bookingDate: Date;
  valueDate: Date | null;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  purposeRaw: string;
  counterpartyName: string | null;
  responsibilityType: "SHARED" | "USER";
  isInternalTransfer: boolean;
  account: { id: string; name: string };
  category: { id: string; name: string } | null;
};

export type SearchResult = {
  rows: SearchResultRow[];
  summary: SearchSummary;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function searchTransactions(args: {
  filters: SearchFilters;
  visibility: Prisma.TransactionWhereInput;
  pagination?: SearchPagination;
  sort?: SortSpec;
}): Promise<SearchResult> {
  const pagination = args.pagination ?? { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  const sort = args.sort ?? defaultSort(args.filters);
  const where = buildTransactionWhere(args.filters, args.visibility);

  if (sort.key === "amountAbs") {
    return searchByAbsoluteAmount({
      where,
      direction: sort.direction,
      pagination,
    });
  }

  const orderBy = buildTransactionOrderBy(sort);

  const [rows, totalCount, incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy,
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
      select: rowSelect,
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({
      where: { ...where, direction: "INCOME" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, direction: "EXPENSE" },
      _sum: { amount: true },
    }),
  ]);

  const incomeTotal = Number(incomeAgg._sum.amount ?? 0);
  const expenseTotal = Math.abs(Number(expenseAgg._sum.amount ?? 0));

  return {
    rows: rows.map(mapRow),
    summary: {
      count: totalCount,
      incomeTotal,
      expenseTotal,
      net: incomeTotal - expenseTotal,
    },
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
  };
}

const rowSelect = {
  id: true,
  bookingDate: true,
  valueDate: true,
  amount: true,
  direction: true,
  purposeRaw: true,
  counterpartyName: true,
  responsibilityType: true,
  isInternalTransfer: true,
  account: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.TransactionSelect;

function mapRow(row: Prisma.TransactionGetPayload<{ select: typeof rowSelect }>): SearchResultRow {
  return {
    id: row.id,
    bookingDate: row.bookingDate,
    valueDate: row.valueDate ?? null,
    amount: Number(row.amount),
    direction: row.direction,
    purposeRaw: row.purposeRaw,
    counterpartyName: row.counterpartyName,
    responsibilityType: row.responsibilityType,
    isInternalTransfer: row.isInternalTransfer,
    account: { id: row.account.id, name: row.account.name },
    category: row.category ? { id: row.category.id, name: row.category.name } : null,
  };
}

async function searchByAbsoluteAmount(args: {
  where: Prisma.TransactionWhereInput;
  direction: "asc" | "desc";
  pagination: SearchPagination;
}): Promise<SearchResult> {
  // For amountAbs sort we fetch every matching id, sort by abs(amount) in JS,
  // page the slice, then hydrate. This keeps the SQL plain and avoids a
  // generated-column migration. Adequate for current scale; migrate to a
  // generated column once the table grows large enough to feel it.
  const [allRows, incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.findMany({
      where: args.where,
      select: { id: true, amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...args.where, direction: "INCOME" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...args.where, direction: "EXPENSE" },
      _sum: { amount: true },
    }),
  ]);

  const sorted = allRows
    .map((r) => ({ id: r.id, abs: Math.abs(Number(r.amount)) }))
    .sort((a, b) => (args.direction === "asc" ? a.abs - b.abs : b.abs - a.abs));

  const start = (args.pagination.page - 1) * args.pagination.pageSize;
  const pageIds = sorted.slice(start, start + args.pagination.pageSize).map((r) => r.id);

  if (pageIds.length === 0) {
    return {
      rows: [],
      summary: {
        count: sorted.length,
        incomeTotal: Number(incomeAgg._sum.amount ?? 0),
        expenseTotal: Math.abs(Number(expenseAgg._sum.amount ?? 0)),
        net:
          Number(incomeAgg._sum.amount ?? 0) -
          Math.abs(Number(expenseAgg._sum.amount ?? 0)),
      },
      page: args.pagination.page,
      pageSize: args.pagination.pageSize,
      totalPages: Math.max(1, Math.ceil(sorted.length / args.pagination.pageSize)),
    };
  }

  const hydrated = await prisma.transaction.findMany({
    where: { id: { in: pageIds } },
    select: rowSelect,
  });
  const order = new Map(pageIds.map((id, i) => [id, i]));
  hydrated.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const incomeTotal = Number(incomeAgg._sum.amount ?? 0);
  const expenseTotal = Math.abs(Number(expenseAgg._sum.amount ?? 0));

  return {
    rows: hydrated.map(mapRow),
    summary: {
      count: sorted.length,
      incomeTotal,
      expenseTotal,
      net: incomeTotal - expenseTotal,
    },
    page: args.pagination.page,
    pageSize: args.pagination.pageSize,
    totalPages: Math.max(1, Math.ceil(sorted.length / args.pagination.pageSize)),
  };
}

export type GroupKey = "byCounterparty" | "byCategory" | "byMonth" | "byAccount";

export type AggregatedRow = {
  key: string;
  label: string;
  total: number;
  totalAbs: number;
  income: number;
  expense: number;
  count: number;
};

export async function aggregateTransactions(args: {
  filters: SearchFilters;
  visibility: Prisma.TransactionWhereInput;
  groupBy: GroupKey;
}): Promise<AggregatedRow[]> {
  const where = buildTransactionWhere(args.filters, args.visibility);

  const rows = await prisma.transaction.findMany({
    where,
    select: {
      amount: true,
      direction: true,
      bookingDate: true,
      counterpartyName: true,
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });

  const buckets = new Map<string, AggregatedRow>();
  for (const r of rows) {
    const amount = Number(r.amount);
    let key: string;
    let label: string;
    switch (args.groupBy) {
      case "byCounterparty":
        key = (r.counterpartyName ?? "Unbekannt").trim() || "Unbekannt";
        label = key;
        break;
      case "byCategory":
        key = r.category?.id ?? "uncategorized";
        label = r.category?.name ?? "Uncategorized";
        break;
      case "byAccount":
        key = r.account.id;
        label = r.account.name;
        break;
      case "byMonth": {
        const monthStart = new Date(
          Date.UTC(r.bookingDate.getUTCFullYear(), r.bookingDate.getUTCMonth(), 1),
        );
        key = monthStart.toISOString().slice(0, 7);
        label = key;
        break;
      }
    }
    const bucket = buckets.get(key) ?? {
      key,
      label,
      total: 0,
      totalAbs: 0,
      income: 0,
      expense: 0,
      count: 0,
    };
    bucket.total += amount;
    bucket.totalAbs += Math.abs(amount);
    if (r.direction === "INCOME") bucket.income += amount;
    else bucket.expense += Math.abs(amount);
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values()).sort((a, b) => b.totalAbs - a.totalAbs);
}
