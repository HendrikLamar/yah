import { describe, expect, it } from "vitest";

import {
  buildTransactionOrderBy,
  buildTransactionWhere,
  defaultSort,
  emptyFilters,
  parseSearchInput,
  parseSortSpec,
  parseUrlSearchParams,
  serializeFiltersToParams,
} from "../transaction-search";

describe("parseSearchInput", () => {
  it("returns empty filters for empty input", () => {
    expect(parseSearchInput("")).toEqual(emptyFilters());
    expect(parseSearchInput("   ")).toEqual(emptyFilters());
  });

  it("captures bare tokens as free text", () => {
    const f = parseSearchInput("rewe groceries");
    expect(f.freeText).toEqual(["rewe", "groceries"]);
    expect(f.quotedPhrases).toEqual([]);
  });

  it("captures quoted phrases verbatim", () => {
    const f = parseSearchInput('"daniel ehmig" amazon');
    expect(f.quotedPhrases).toEqual(["daniel ehmig"]);
    expect(f.freeText).toEqual(["amazon"]);
  });

  it("parses from: and to:", () => {
    const f = parseSearchInput("from:2026-01-01 to:2026-03-31");
    expect(f.from?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(f.to?.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(f.to?.getUTCHours()).toBe(23);
  });

  it("expands month: to a full-month range", () => {
    const f = parseSearchInput("month:2026-02");
    expect(f.from?.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(f.to?.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("expands year: to a full-year range", () => {
    const f = parseSearchInput("year:2025");
    expect(f.from?.toISOString().slice(0, 10)).toBe("2025-01-01");
    expect(f.to?.toISOString().slice(0, 10)).toBe("2025-12-31");
  });

  it("parses amount comparison operators", () => {
    const gt = parseSearchInput("amount>50");
    expect(gt.minAmount).toBe(50);
    const lt = parseSearchInput("amount<200");
    expect(lt.maxAmount).toBe(200);
    const eq = parseSearchInput("amount=99.99");
    expect(eq.minAmount).toBe(99.99);
    expect(eq.maxAmount).toBe(99.99);
  });

  it("parses category, account, counterparty", () => {
    const f = parseSearchInput("category:groceries account:girokonto counterparty:rewe");
    expect(f.category).toEqual(["groceries"]);
    expect(f.account).toEqual(["girokonto"]);
    expect(f.counterparty).toEqual(["rewe"]);
  });

  it("parses direction, transfer, responsibility", () => {
    const f = parseSearchInput("direction:expense transfer:true responsibility:shared");
    expect(f.direction).toBe("EXPENSE");
    expect(f.transferOnly).toBe(true);
    expect(f.responsibility).toBe("SHARED");
  });

  it("parses sort: with key and direction", () => {
    const f = parseSearchInput("sort:amount.desc");
    expect(f.sort).toEqual({ key: "amount", direction: "desc" });
  });

  it("ignores unknown operators and falls back to free text", () => {
    const f = parseSearchInput("foo:bar rewe");
    expect(f.freeText).toContain("foo:bar");
    expect(f.freeText).toContain("rewe");
  });

  it("mixes operators and free text in one query", () => {
    const f = parseSearchInput('from:2026-01-01 "daniel ehmig" amount>50 category:rent rewe');
    expect(f.from?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(f.quotedPhrases).toEqual(["daniel ehmig"]);
    expect(f.minAmount).toBe(50);
    expect(f.category).toEqual(["rent"]);
    expect(f.freeText).toEqual(["rewe"]);
  });
});

describe("parseSortSpec", () => {
  it("accepts every supported key", () => {
    const keys = [
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
    for (const key of keys) {
      expect(parseSortSpec(`${key}.asc`)).toEqual({ key, direction: "asc" });
      expect(parseSortSpec(`${key}.desc`)).toEqual({ key, direction: "desc" });
    }
  });

  it("defaults direction to desc for unknown direction values", () => {
    expect(parseSortSpec("amount.weird")).toEqual({ key: "amount", direction: "desc" });
  });

  it("rejects unknown keys", () => {
    expect(parseSortSpec("nope.asc")).toBeNull();
    expect(parseSortSpec("")).toBeNull();
  });
});

describe("buildTransactionOrderBy", () => {
  it("returns the right column plus a stable id tiebreaker", () => {
    const result = buildTransactionOrderBy({ key: "bookingDate", direction: "desc" });
    expect(result).toEqual([{ bookingDate: "desc" }, { id: "desc" }]);
  });

  it("maps joined sort keys to relation orderBy shape", () => {
    const acc = buildTransactionOrderBy({ key: "account", direction: "asc" });
    expect(acc[0]).toEqual({ account: { name: "asc" } });
    const cat = buildTransactionOrderBy({ key: "category", direction: "desc" });
    expect(cat[0]).toEqual({ category: { name: "desc" } });
  });

  it("falls back to amount for amountAbs in pure Prisma orderBy (raw SQL path expected at the query layer)", () => {
    const result = buildTransactionOrderBy({ key: "amountAbs", direction: "desc" });
    expect(result[0]).toEqual({ amount: "desc" });
  });

  it("preserves direction in tiebreaker", () => {
    const r = buildTransactionOrderBy({ key: "amount", direction: "asc" });
    expect(r[1]).toEqual({ id: "asc" });
  });
});

describe("buildTransactionWhere", () => {
  const visibility = {
    householdId: "h1",
    OR: [{ account: { visibilityOwnerType: "SHARED" as const } }],
  };

  it("composes with the visibility filter and never replaces it", () => {
    const where = buildTransactionWhere(emptyFilters(), visibility);
    expect(where.householdId).toBe("h1");
    expect(where.OR).toEqual(visibility.OR);
    // No transfers by default
    expect(where.AND).toEqual([{ isInternalTransfer: false }]);
  });

  it("applies direction, responsibility, transferOnly", () => {
    const filters = emptyFilters();
    filters.direction = "EXPENSE";
    filters.responsibility = "SHARED";
    filters.transferOnly = true;
    const where = buildTransactionWhere(filters, visibility);
    const conds = (where.AND as Array<Record<string, unknown>>) ?? [];
    expect(conds).toContainEqual({ direction: "EXPENSE" });
    expect(conds).toContainEqual({ responsibilityType: "SHARED" });
    expect(conds).toContainEqual({ isInternalTransfer: true });
  });

  it("includes transfers when includeTransfers=true", () => {
    const filters = emptyFilters();
    filters.includeTransfers = true;
    const where = buildTransactionWhere(filters, visibility);
    expect((where.AND as Array<Record<string, unknown>>) ?? []).not.toContainEqual({
      isInternalTransfer: false,
    });
  });

  it("translates amount range filters into abs comparisons on signed amount", () => {
    const filters = emptyFilters();
    filters.minAmount = 50;
    filters.maxAmount = 200;
    const where = buildTransactionWhere(filters, visibility);
    const conds = (where.AND as Array<Record<string, unknown>>) ?? [];
    // amount>=50 OR amount<=-50 (i.e. |amount| >= 50)
    expect(conds).toContainEqual({
      OR: [{ amount: { gte: 50 } }, { amount: { lte: -50 } }],
    });
    expect(conds).toContainEqual({
      AND: [{ amount: { lte: 200 } }, { amount: { gte: -200 } }],
    });
  });

  it("ANDs each free-text term across the three searchable columns", () => {
    const filters = emptyFilters();
    filters.freeText = ["rewe", "berlin"];
    const where = buildTransactionWhere(filters, visibility);
    const conds = (where.AND as Array<Record<string, unknown>>) ?? [];
    // each term has its own OR group
    expect(
      conds.filter((c) => Array.isArray((c as { OR?: unknown[] }).OR)).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("treats category operator as slug-equals OR name-contains", () => {
    const filters = emptyFilters();
    filters.category = ["Groceries"];
    const where = buildTransactionWhere(filters, visibility);
    const conds = (where.AND as Array<Record<string, unknown>>) ?? [];
    const catCond = conds.find(
      (c) => "OR" in c && Array.isArray((c as { OR: unknown[] }).OR),
    );
    expect(catCond).toBeTruthy();
  });

  it("does not regress visibility when filters are present", () => {
    const filters = emptyFilters();
    filters.direction = "INCOME";
    const where = buildTransactionWhere(filters, visibility);
    expect(where.householdId).toBe("h1");
    expect(where.OR).toEqual(visibility.OR);
  });
});

describe("parseUrlSearchParams / serializeFiltersToParams round-trip", () => {
  it("round-trips a representative query", () => {
    const f = emptyFilters();
    f.freeText = ["rewe"];
    f.quotedPhrases = ["daniel ehmig"];
    f.from = new Date("2026-01-01T00:00:00.000Z");
    f.to = new Date("2026-03-31T23:59:59.999Z");
    f.direction = "EXPENSE";
    f.responsibility = "SHARED";
    f.minAmount = 50;
    f.maxAmount = 200;
    f.includeTransfers = true;
    f.counterparty = ["rewe"];
    f.category = ["groceries"];
    f.account = ["girokonto"];
    f.sort = { key: "amount", direction: "asc" };

    const params = serializeFiltersToParams(f);
    const round = parseUrlSearchParams(params);

    expect(round.freeText).toEqual(["rewe"]);
    expect(round.quotedPhrases).toEqual(["daniel ehmig"]);
    expect(round.from?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(round.to?.toISOString().slice(0, 10)).toBe("2026-03-31");
    expect(round.direction).toBe("EXPENSE");
    expect(round.responsibility).toBe("SHARED");
    expect(round.minAmount).toBe(50);
    expect(round.maxAmount).toBe(200);
    expect(round.includeTransfers).toBe(true);
    expect(round.counterparty).toEqual(["rewe"]);
    expect(round.category).toEqual(["groceries"]);
    expect(round.account).toEqual(["girokonto"]);
    expect(round.sort).toEqual({ key: "amount", direction: "asc" });
  });
});

describe("defaultSort", () => {
  it("defaults to bookingDate desc for an empty query", () => {
    expect(defaultSort(emptyFilters())).toEqual({ key: "bookingDate", direction: "desc" });
  });

  it("switches to amountAbs desc when amount filters are present", () => {
    const f = emptyFilters();
    f.minAmount = 100;
    expect(defaultSort(f)).toEqual({ key: "amountAbs", direction: "desc" });
  });

  it("respects an explicit sort over the heuristic", () => {
    const f = emptyFilters();
    f.minAmount = 100;
    f.sort = { key: "counterpartyName", direction: "asc" };
    expect(defaultSort(f)).toEqual({ key: "counterpartyName", direction: "asc" });
  });
});
