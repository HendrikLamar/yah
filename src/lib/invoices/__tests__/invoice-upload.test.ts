import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";

import { uploadInvoiceDocument } from "../invoice-upload";
import { extractInvoiceMetadataFromFile } from "../extraction";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
    },
    invoiceDocument: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../extraction", () => ({
  extractInvoiceMetadataFromFile: vi.fn(),
}));

describe("uploadInvoiceDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractInvoiceMetadataFromFile).mockResolvedValue({
      vendorName: "Holzbau Stark GmbH",
      invoiceNumber: "R-2026-204",
      invoiceDate: "2026-05-14",
      dueDate: "2026-05-28",
      totalAmount: 1951.6,
      currency: "EUR",
      text: "invoice text",
      method: "pdf-text",
      confidence: 0.92,
      documentSha256: "abc123",
    } as never);
  });

  it("stores extracted metadata and persists split auto-matches when multiple payments cover the invoice total", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        id: "tx-1",
        bookingDate: new Date("2026-05-20T00:00:00.000Z"),
        amount: "-1000.00",
        currency: "EUR",
        direction: "EXPENSE",
        counterpartyName: "Holzbau Stark GmbH",
        normalizedMerchant: "holzbau stark",
        purposeRaw: "Abschlag Rechnung R-2026-204",
        invoicePaymentMatches: [],
      },
      {
        id: "tx-2",
        bookingDate: new Date("2026-05-27T00:00:00.000Z"),
        amount: "-951.60",
        currency: "EUR",
        direction: "EXPENSE",
        counterpartyName: "Holzbau Stark GmbH",
        normalizedMerchant: "holzbau stark",
        purposeRaw: "Restzahlung Rechnung R-2026-204",
        invoicePaymentMatches: [],
      },
    ] as never);
    vi.mocked(prisma.invoiceDocument.create).mockResolvedValue({
      id: "invoice-1",
      fileName: "rechnung.pdf",
      totalAmount: "1951.60",
      matchStatus: "AUTO_MATCHED",
      matchReason: "split payment auto-match",
      matchConfidence: "0.91",
      matchedTransaction: {
        id: "tx-1",
        account: { name: "DKB Giro" },
        category: null,
      },
      paymentMatches: [
        { allocatedAmount: "1000.00", transaction: { id: "tx-1", account: { name: "DKB Giro" }, category: null } },
        { allocatedAmount: "951.60", transaction: { id: "tx-2", account: { name: "DKB Giro" }, category: null } },
      ],
    } as never);

    const file = new File([new Uint8Array([1, 2, 3])], "rechnung.pdf", { type: "application/pdf" });

    const result = await uploadInvoiceDocument({
      householdId: "household-1",
      uploadedByUserId: "user-1",
      file,
    });

    expect(extractInvoiceMetadataFromFile).toHaveBeenCalledWith(file, expect.any(Buffer));
    expect(prisma.invoiceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          vendorName: "Holzbau Stark GmbH",
          invoiceNumber: "R-2026-204",
          documentSha256: "abc123",
          matchStatus: "AUTO_MATCHED",
          paymentMatches: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ transactionId: "tx-1", allocatedAmount: "1000.00" }),
              expect.objectContaining({ transactionId: "tx-2", allocatedAmount: "951.60" }),
            ]),
          }),
        }),
      }),
    );
    expect(result.linkedPaymentCount).toBe(2);
    expect(result.remainingAmount).toBe(0);
  });

  it("creates a partial auto-match from a larger bundled payment when only part of the payment belongs to this invoice", async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        id: "tx-bundle",
        bookingDate: new Date("2026-06-10T00:00:00.000Z"),
        amount: "-1200.00",
        currency: "EUR",
        direction: "EXPENSE",
        counterpartyName: "Holzbau Stark GmbH",
        normalizedMerchant: "holzbau stark",
        purposeRaw: "Sammelzahlung R-2026-204 und R-2026-205",
        invoicePaymentMatches: [{ allocatedAmount: "250.00" }],
      },
    ] as never);
    vi.mocked(prisma.invoiceDocument.create).mockResolvedValue({
      id: "invoice-2",
      fileName: "rechnung.pdf",
      totalAmount: "1951.60",
      matchStatus: "PARTIALLY_MATCHED",
      matchReason: "bundled payment covers invoice · vendor name match",
      matchConfidence: "0.83",
      matchedTransaction: {
        id: "tx-bundle",
        account: { name: "DKB Giro" },
        category: null,
      },
      paymentMatches: [
        { allocatedAmount: "950.00", transaction: { id: "tx-bundle", account: { name: "DKB Giro" }, category: null } },
      ],
    } as never);

    const file = new File(["invoice"], "rechnung.pdf", { type: "application/pdf" });

    await uploadInvoiceDocument({
      householdId: "household-1",
      uploadedByUserId: "user-1",
      file,
      vendorName: "Holzbau Stark GmbH",
      invoiceDate: "2026-05-14",
      totalAmount: 1951.6,
    });

    expect(prisma.invoiceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          matchStatus: "PARTIALLY_MATCHED",
          paymentMatches: {
            create: [expect.objectContaining({ transactionId: "tx-bundle", allocatedAmount: "950.00" })],
          },
        }),
      }),
    );
  });
});
