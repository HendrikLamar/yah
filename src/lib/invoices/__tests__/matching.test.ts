import { describe, expect, it } from "vitest";

import { findSuggestedInvoicePaymentMatches } from "../matching";

describe("findSuggestedInvoicePaymentMatches", () => {
  it("auto-suggests multiple payments when split transactions sum to the invoice total", () => {
    const plan = findSuggestedInvoicePaymentMatches(
      {
        vendorName: "Holzbau Stark GmbH",
        invoiceNumber: "R-2026-204",
        invoiceDate: new Date("2026-05-14T00:00:00.000Z"),
        dueDate: new Date("2026-05-28T00:00:00.000Z"),
        totalAmount: 1951.6,
        currency: "EUR",
      },
      [
        {
          id: "tx-1",
          bookingDate: new Date("2026-05-20T00:00:00.000Z"),
          amount: -1000,
          currency: "EUR",
          direction: "EXPENSE",
          counterpartyName: "Holzbau Stark GmbH",
          normalizedMerchant: "holzbau stark",
          purposeRaw: "Abschlag Rechnung R-2026-204",
          allocatedAmount: 0,
        },
        {
          id: "tx-2",
          bookingDate: new Date("2026-05-27T00:00:00.000Z"),
          amount: -951.6,
          currency: "EUR",
          direction: "EXPENSE",
          counterpartyName: "Holzbau Stark GmbH",
          normalizedMerchant: "holzbau stark",
          purposeRaw: "Restzahlung Rechnung R-2026-204",
          allocatedAmount: 0,
        },
      ],
    );

    expect(plan).not.toBeNull();
    expect(plan?.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ transactionId: "tx-1", allocatedAmount: 1000 }),
        expect.objectContaining({ transactionId: "tx-2", allocatedAmount: 951.6 }),
      ]),
    );
    expect(plan?.remainingAmount).toBe(0);
  });

  it("suggests a partial allocation from a larger bundled payment", () => {
    const plan = findSuggestedInvoicePaymentMatches(
      {
        vendorName: "Elektro Nord GmbH",
        invoiceNumber: "EN-77",
        invoiceDate: new Date("2026-06-01T00:00:00.000Z"),
        dueDate: new Date("2026-06-15T00:00:00.000Z"),
        totalAmount: 420,
        currency: "EUR",
      },
      [
        {
          id: "tx-bundle",
          bookingDate: new Date("2026-06-10T00:00:00.000Z"),
          amount: -1200,
          currency: "EUR",
          direction: "EXPENSE",
          counterpartyName: "Elektro Nord GmbH",
          normalizedMerchant: "elektro nord",
          purposeRaw: "Sammelzahlung EN-77 und EN-78",
          allocatedAmount: 250,
        },
      ],
    );

    expect(plan).not.toBeNull();
    expect(plan?.matches).toEqual([
      expect.objectContaining({
        transactionId: "tx-bundle",
        allocatedAmount: 420,
      }),
    ]);
    expect(plan?.remainingAmount).toBe(0);
  });
});
