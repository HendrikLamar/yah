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
    },
    transaction: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    importBatch: {
      create: vi.fn(),
    },
  },
}));

describe("importCsvTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.category.findUnique).mockResolvedValue({ id: "category-1" } as never);
    vi.mocked(prisma.bankConnection.upsert).mockResolvedValue({ id: "connection-1" } as never);
    vi.mocked(prisma.account.upsert).mockResolvedValue({ id: "account-1", name: "CSV Import" } as never);
    vi.mocked(prisma.transaction.createMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.importBatch.create).mockResolvedValue({ id: "batch-1" } as never);
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

    const firstExternalId = upsertCalls[0]?.[0].where.bankConnectionId_externalAccountId.externalAccountId;
    const secondExternalId = upsertCalls[1]?.[0].where.bankConnectionId_externalAccountId.externalAccountId;

    expect(firstExternalId).not.toBe(secondExternalId);
    expect(firstExternalId).toContain("user-a");
    expect(secondExternalId).toContain("user-b");
  });
});