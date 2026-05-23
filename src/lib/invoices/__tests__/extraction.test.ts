import { describe, expect, it, vi } from "vitest";

import {
  extractInvoiceMetadataFromFile,
  parseInvoiceMetadataFromText,
} from "../extraction";

describe("parseInvoiceMetadataFromText", () => {
  it("extracts vendor, invoice number, invoice date, due date, and total from a German invoice", () => {
    const sample = `
      Holzbau Stark GmbH
      Hafenweg 12
      20457 Hamburg

      Rechnung Nr. R-2026-204
      Rechnungsdatum: 14.05.2026
      Fällig am: 28.05.2026

      Leistungszeitraum 05/2026
      Nettobetrag 1.640,00 EUR
      MwSt 19% 311,60 EUR
      Gesamtbetrag 1.951,60 EUR
    `;

    expect(parseInvoiceMetadataFromText(sample)).toEqual(
      expect.objectContaining({
        vendorName: "Holzbau Stark GmbH",
        invoiceNumber: "R-2026-204",
        invoiceDate: "2026-05-14",
        dueDate: "2026-05-28",
        totalAmount: 1951.6,
        currency: "EUR",
      }),
    );
  });

  it("returns null fields when the document text does not contain enough invoice metadata", () => {
    const sample = `Random note\nMeeting tomorrow\nNo invoice details here`;

    expect(parseInvoiceMetadataFromText(sample)).toEqual({
      currency: "EUR",
      dueDate: null,
      invoiceDate: null,
      invoiceNumber: null,
      totalAmount: null,
      vendorName: null,
    });
  });
});

describe("extractInvoiceMetadataFromFile with AI fallback", () => {
  it("invokes the fallback when local extraction is low-confidence and missing required fields", async () => {
    const file = new File(["Random note\nNothing useful"], "note.txt", {
      type: "text/plain",
    });

    const fallbackProvider = vi.fn().mockResolvedValue({
      provider: "anthropic",
      model: "claude-haiku-4-5-20251001",
      payload: {
        vendorName: "Stark GmbH",
        invoiceNumber: "R-99",
        invoiceDate: "2026-05-14",
        dueDate: null,
        totalAmount: 100,
        currency: "EUR",
      },
    });

    const result = await extractInvoiceMetadataFromFile(file, undefined, {
      fallbackProvider,
    });

    expect(fallbackProvider).toHaveBeenCalledTimes(1);
    expect(result.method).toBe("ai-fallback");
    expect(result.vendorName).toBe("Stark GmbH");
    expect(result.invoiceNumber).toBe("R-99");
    expect(result.totalAmount).toBe(100);
    expect(result.fallbackProvider).toBe("anthropic");
  });

  it("does NOT invoke the fallback when local extraction succeeded", async () => {
    const file = new File(
      [
        "Holzbau Stark GmbH\nRechnung Nr. R-1\nRechnungsdatum: 14.05.2026\nGesamtbetrag 100,00 EUR",
      ],
      "ok.txt",
      { type: "text/plain" },
    );

    const fallbackProvider = vi.fn();
    const result = await extractInvoiceMetadataFromFile(file, undefined, {
      fallbackProvider,
    });
    expect(fallbackProvider).not.toHaveBeenCalled();
    expect(result.method).not.toBe("ai-fallback");
  });

  it("falls back gracefully if the AI provider throws", async () => {
    const file = new File(["Random note"], "note.txt", { type: "text/plain" });

    const fallbackProvider = vi.fn().mockRejectedValue(new Error("rate limited"));
    const result = await extractInvoiceMetadataFromFile(file, undefined, {
      fallbackProvider,
    });
    expect(result.method).not.toBe("ai-fallback");
    expect(result.vendorName).toBeNull();
  });

  it("does not run the fallback when fallbackProvider is explicitly null", async () => {
    const file = new File(["Random note"], "note.txt", { type: "text/plain" });
    const result = await extractInvoiceMetadataFromFile(file, undefined, {
      fallbackProvider: null,
    });
    expect(result.method).not.toBe("ai-fallback");
  });
});
