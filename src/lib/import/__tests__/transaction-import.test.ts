import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";

import { importCsvTransactions } from "../transaction-import";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    category: {
      findUnique: vi.fn(),
    },
    bankConnection: {
      upsert: vi.fn(),
    },
    account: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
    transaction: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    importBatch: {
      create: vi.fn(),
    },
    categorizationRule: {
      findMany: vi.fn(),
    },
  },
}));

describe("importCsvTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: "category-uncat" } as never);
    vi.mocked(prisma.bankConnection.upsert).mockResolvedValue({ id: "connection-1" } as never);
    vi.mocked(prisma.account.upsert).mockResolvedValue({ id: "account-1", name: "CSV Import" } as never);
    vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.importBatch.create).mockResolvedValue({ id: "batch-1" } as never);
    vi.mocked(prisma.categorizationRule.findMany).mockResolvedValue([] as never);
  });

  it("uses different private account identities for different users even with the same account name", async () => {
    const transactions = [
      {
        bookingDate: "2026-05-18",
        valueDate: "2026-05-18",
        amount: -12.5,
        currency: "EUR",
        direction: "EXPENSE" as const,
        counterpartyName: "Parkster",
        purposeRaw: "Parkticket",
      },
    ];

    await importCsvTransactions({
      householdId: "household-1",
      accountName: "Private CSV",
      ownerUserId: "user-a",
      userId: "user-a",
      transactions,
    });
    await importCsvTransactions({
      householdId: "household-1",
      accountName: "Private CSV",
      ownerUserId: "user-b",
      userId: "user-b",
      transactions,
    });

    const upsertCalls = vi.mocked(prisma.account.upsert).mock.calls;
    expect(upsertCalls).toHaveLength(2);

    const firstExternalId =
      upsertCalls[0]?.[0]?.where.bankConnectionId_externalAccountId?.externalAccountId;
    const secondExternalId =
      upsertCalls[1]?.[0]?.where.bankConnectionId_externalAccountId?.externalAccountId;

    expect(firstExternalId).not.toBe(secondExternalId);
    expect(firstExternalId).toContain("user-a");
    expect(secondExternalId).toContain("user-b");
  });

  it("imports into an existing account without upserting a new one", async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: "account-existing",
      name: "Girokonto Hendrik",
    } as never);

    const transactions = [
      {
        bookingDate: "2026-05-18",
        valueDate: "2026-05-18",
        amount: -12.5,
        currency: "EUR",
        direction: "EXPENSE" as const,
        counterpartyName: "Parkster",
        purposeRaw: "Parkticket",
      },
    ];

    const result = await importCsvTransactions({
      householdId: "household-1",
      accountId: "account-existing",
      ownerUserId: "user-a",
      userId: "user-a",
      transactions,
    });

    expect(prisma.account.findFirst).toHaveBeenCalledWith({
      where: { id: "account-existing", householdId: "household-1" },
      select: { id: true, name: true },
    });
    expect(prisma.account.upsert).not.toHaveBeenCalled();
    expect(prisma.bankConnection.upsert).not.toHaveBeenCalled();
    expect(result.accountName).toBe("Girokonto Hendrik");

    const batchCall = vi.mocked(prisma.importBatch.create).mock.calls[0]?.[0];
    expect(batchCall?.data.accountName).toBe("Girokonto Hendrik");
  });

  it("throws when neither accountId nor accountName is supplied", async () => {
    await expect(
      importCsvTransactions({
        householdId: "household-1",
        userId: "user-a",
        transactions: [],
      }),
    ).rejects.toThrow(/Either accountId or accountName/);
  });

  it("throws when both accountId and accountName are supplied", async () => {
    await expect(
      importCsvTransactions({
        householdId: "household-1",
        accountId: "a",
        accountName: "b",
        userId: "user-a",
        transactions: [],
      }),
    ).rejects.toThrow(/either accountId or accountName, not both/);
  });

  it("throws when the existing account is not found in the household", async () => {
    vi.mocked(prisma.account.findFirst).mockResolvedValue(null as never);

    await expect(
      importCsvTransactions({
        householdId: "household-1",
        accountId: "missing",
        userId: "user-a",
        transactions: [
          {
            bookingDate: "2026-05-18",
            valueDate: null,
            amount: -1,
            currency: "EUR",
            direction: "EXPENSE" as const,
            counterpartyName: null,
            purposeRaw: "x",
          },
        ],
      }),
    ).rejects.toThrow(/Account not found/);
  });

  it("applies an enabled rule at import time to set categoryId and isInternalTransfer", async () => {
    vi.mocked(prisma.categorizationRule.findMany).mockResolvedValue([
      {
        id: "rule-1",
        householdId: "household-1",
        name: "REWE → Groceries",
        priority: 100,
        isEnabled: true,
        matchField: "COUNTERPARTY_NAME",
        matchOperator: "CONTAINS",
        matchValue: "REWE",
        accountId: null,
        actionCategoryId: "category-groceries",
        actionResponsibilityType: "SHARED",
        actionResponsibilityUserId: null,
        actionMarkTransfer: false,
        createdByUserId: "user-a",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "rule-2",
        householdId: "household-1",
        name: "Sparen → transfer",
        priority: 200,
        isEnabled: true,
        matchField: "PURPOSE_RAW",
        matchOperator: "CONTAINS",
        matchValue: "Sparen",
        accountId: null,
        actionCategoryId: null,
        actionResponsibilityType: null,
        actionResponsibilityUserId: null,
        actionMarkTransfer: true,
        createdByUserId: "user-a",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 2 } as never);

    await importCsvTransactions({
      householdId: "household-1",
      accountName: "Giro",
      ownerUserId: "user-a",
      userId: "user-a",
      transactions: [
        {
          bookingDate: "2026-05-02",
          valueDate: "2026-05-02",
          amount: -42.5,
          currency: "EUR",
          direction: "EXPENSE",
          counterpartyName: "REWE BERLIN",
          purposeRaw: "Wocheneinkauf",
        },
        {
          bookingDate: "2026-05-03",
          valueDate: "2026-05-03",
          amount: -500,
          currency: "EUR",
          direction: "EXPENSE",
          counterpartyName: "Hendrik Sparkonto",
          purposeRaw: "Sparen Mai",
        },
      ],
    });

    const createManyCall = vi.mocked(prisma.transaction.createMany).mock.calls[0]?.[0];
    const rows = createManyCall?.data as Array<Record<string, unknown>>;

    expect(rows[0]?.categoryId).toBe("category-groceries");
    expect(rows[0]?.responsibilityType).toBe("SHARED");
    expect(rows[0]?.isInternalTransfer).toBe(false);

    expect(rows[1]?.categoryId).toBe("category-uncat");
    expect(rows[1]?.isInternalTransfer).toBe(true);
  });
});