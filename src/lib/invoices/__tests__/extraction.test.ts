import { describe, expect, it } from "vitest";

import { parseInvoiceMetadataFromText } from "../extraction";

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
