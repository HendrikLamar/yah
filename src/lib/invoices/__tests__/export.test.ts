import { describe, expect, it } from "vitest";

import { buildSubsidyExportRows } from "../export";

describe("buildSubsidyExportRows", () => {
  it("emits one funding-proof row per invoice-payment allocation", () => {
    const rows = buildSubsidyExportRows([
      {
        id: "invoice-1",
        fileName: "rechnung-1.pdf",
        vendorName: "Holzbau Stark GmbH",
        invoiceNumber: "R-2026-204",
        invoiceDate: new Date("2026-05-14T00:00:00.000Z"),
        dueDate: new Date("2026-05-28T00:00:00.000Z"),
        totalAmount: "1951.60",
        currency: "EUR",
        notes: null,
        matchStatus: "MANUALLY_CONFIRMED",
        matchReason: "split payment confirmed",
        documentSha256: "abc123",
        uploadedByUser: { displayName: "Hendrik" },
        paymentMatches: [
          {
            id: "match-1",
            allocatedAmount: "1000.00",
            transaction: {
              id: "tx-1",
              bookingDate: new Date("2026-05-20T00:00:00.000Z"),
              amount: "-1000.00",
              counterpartyName: "Holzbau Stark GmbH",
              purposeRaw: "Abschlag Rechnung R-2026-204",
              account: { name: "DKB Giro" },
              category: { name: "Hausbau" },
            },
          },
          {
            id: "match-2",
            allocatedAmount: "951.60",
            transaction: {
              id: "tx-2",
              bookingDate: new Date("2026-05-27T00:00:00.000Z"),
              amount: "-951.60",
              counterpartyName: "Holzbau Stark GmbH",
              purposeRaw: "Restzahlung Rechnung R-2026-204",
              account: { name: "DKB Giro" },
              category: { name: "Hausbau" },
            },
          },
        ],
      },
    ] as never);

    expect(rows[0]).toEqual([
      "schema_version",
      "beleg_id",
      "beleg_dateiname",
      "beleg_sha256",
      "lieferant",
      "rechnungsnummer",
      "rechnungsdatum",
      "faellig_am",
      "waehrung",
      "rechnungsbetrag_brutto",
      "zuordnung_id",
      "zahlungs_id",
      "zahlungsdatum",
      "zahlungskonto",
      "zahlung_gegenpartei",
      "zahlungsreferenz",
      "zugeordneter_betrag",
      "offener_restbetrag",
      "kostenkategorie",
      "nachweis_status",
      "bearbeiter",
      "kommentar",
    ]);
    expect(rows[1]).toEqual(
      expect.arrayContaining(["subsidy-proof-v1", "invoice-1", "match-1", "tx-1", "1000.00", "0.00"]),
    );
    expect(rows[2]).toEqual(
      expect.arrayContaining(["subsidy-proof-v1", "invoice-1", "match-2", "tx-2", "951.60", "0.00"]),
    );
  });
});
