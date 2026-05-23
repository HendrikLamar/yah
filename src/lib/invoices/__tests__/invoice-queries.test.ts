import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";

import {
  clearInvoiceMatch,
  confirmInvoiceMatch,
  listMatchCandidatesForInvoice,
} from "../invoice-queries";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    invoiceDocument: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    invoicePaymentMatch: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe("invoice queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a manual allocation and refreshes the invoice aggregate state", async () => {
    vi.mocked(prisma.invoiceDocument.findFirst).mockResolvedValue({
      id: "invoice-1",
      totalAmount: "1951.60",
      paymentMatches: [],
    } as never);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
      id: "tx-1",
      amount: "-1000.00",
      invoicePaymentMatches: [],
    } as never);
    vi.mocked(prisma.invoicePaymentMatch.upsert).mockResolvedValue({ id: "match-1" } as never);
    vi.mocked(prisma.invoiceDocument.findUnique)
      .mockResolvedValueOnce({
        id: "invoice-1",
        totalAmount: "1951.60",
        paymentMatches: [
          {
            allocatedAmount: "1000.00",
            matchStatus: "MANUALLY_CONFIRMED",
            matchConfidence: "1.00",
            matchReason: "manually confirmed allocation",
            transaction: { id: "tx-1" },
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        id: "invoice-1",
        paymentMatches: [{ id: "match-1", allocatedAmount: "1000.00" }],
      } as never);
    vi.mocked(prisma.invoiceDocument.update).mockResolvedValue({ id: "invoice-1" } as never);

    await confirmInvoiceMatch({
      householdId: "household-1",
      invoiceId: "invoice-1",
      transactionId: "tx-1",
      allocatedAmount: 1000,
    });

    expect(prisma.invoicePaymentMatch.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          transactionId: "tx-1",
          allocatedAmount: "1000.00",
        }),
      }),
    );
    expect(prisma.invoiceDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchedTransactionId: "tx-1",
          matchStatus: "PARTIALLY_MATCHED",
        }),
      }),
    );
  });

  it("clears either one allocation or all allocations for an invoice", async () => {
    vi.mocked(prisma.invoiceDocument.findFirst).mockResolvedValue({ id: "invoice-1" } as never);
    vi.mocked(prisma.invoicePaymentMatch.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.invoiceDocument.findUnique)
      .mockResolvedValueOnce({
        id: "invoice-1",
        totalAmount: "1951.60",
        paymentMatches: [],
      } as never)
      .mockResolvedValueOnce({
        id: "invoice-1",
        paymentMatches: [],
      } as never);
    vi.mocked(prisma.invoiceDocument.update).mockResolvedValue({ id: "invoice-1" } as never);

    await clearInvoiceMatch({
      householdId: "household-1",
      invoiceId: "invoice-1",
      transactionId: "tx-1",
    });

    expect(prisma.invoicePaymentMatch.deleteMany).toHaveBeenCalledWith({
      where: {
        invoiceId: "invoice-1",
        transactionId: "tx-1",
      },
    });
  });

  it("ranks transaction candidates for manual review and exposes remaining free payment amount", async () => {
    vi.mocked(prisma.invoiceDocument.findFirst).mockResolvedValue({
      id: "invoice-1",
      vendorName: "Holzbau Stark GmbH",
      invoiceNumber: "R-2026-204",
      invoiceDate: new Date("2026-05-10T00:00:00.000Z"),
      dueDate: new Date("2026-05-24T00:00:00.000Z"),
      totalAmount: "1951.60",
      currency: "EUR",
      paymentMatches: [{ transactionId: "tx-old", allocatedAmount: "1000.00" }],
    } as never);
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        id: "tx-best",
        bookingDate: new Date("2026-05-23T00:00:00.000Z"),
        amount: "-951.60",
        currency: "EUR",
        direction: "EXPENSE",
        counterpartyName: "Holzbau Stark GmbH",
        normalizedMerchant: "holzbau stark",
        purposeRaw: "Restzahlung Rechnung R-2026-204",
        account: { name: "DKB Giro" },
        category: { name: "Hausbau" },
        invoicePaymentMatches: [],
      },
      {
        id: "tx-bundle",
        bookingDate: new Date("2026-05-22T00:00:00.000Z"),
        amount: "-1500.00",
        currency: "EUR",
        direction: "EXPENSE",
        counterpartyName: "Holzbau Stark GmbH",
        normalizedMerchant: "holzbau stark",
        purposeRaw: "Sammelzahlung Rechnung R-2026-204 und R-2026-205",
        account: { name: "DKB Giro" },
        category: null,
        invoicePaymentMatches: [{ invoiceId: "invoice-elsewhere", allocatedAmount: "400.00" }],
      },
    ] as never);

    const candidates = await listMatchCandidatesForInvoice({
      householdId: "household-1",
      invoiceId: "invoice-1",
    });

    expect(candidates[0]).toEqual(
      expect.objectContaining({
        id: "tx-best",
        accountName: "DKB Giro",
        availableAmount: 951.6,
      }),
    );
    expect(candidates.find((candidate) => candidate.id === "tx-bundle")).toEqual(
      expect.objectContaining({
        availableAmount: 1100,
      }),
    );
  });
});
