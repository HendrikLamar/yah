import { describe, expect, it } from "vitest";

import { parseTransactionCsv } from "../csv";

describe("parseTransactionCsv", () => {
  it("parses DKB-style semicolon CSV exports into normalized transactions", () => {
    const csv = [
      "Buchungstag;Wertstellung;Auftraggeber / Begünstigter;Verwendungszweck;Betrag (EUR)",
      '02.05.2026;02.05.2026;REWE BERLIN;Wocheneinkauf;-84,21',
      '03.05.2026;03.05.2026;HENDRIK GEHALT;Salary May;3200,00',
    ].join("\n");

    const parsed = parseTransactionCsv(csv);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      counterpartyName: "REWE BERLIN",
      purposeRaw: "Wocheneinkauf",
      amount: -84.21,
      direction: "EXPENSE",
      currency: "EUR",
      bookingDate: "2026-05-02",
    });
    expect(parsed[1]).toMatchObject({
      amount: 3200,
      direction: "INCOME",
      bookingDate: "2026-05-03",
    });
  });

  it("supports comma-separated exports with english-style headers", () => {
    const csv = [
      "booking_date,value_date,counterparty,purpose,amount,currency",
      '2026-05-04,2026-05-04,Parkster,Parking,12.50,EUR',
    ].join("\n");

    const parsed = parseTransactionCsv(csv);

    expect(parsed).toEqual([
      {
        bookingDate: "2026-05-04",
        valueDate: "2026-05-04",
        counterpartyName: "Parkster",
        purposeRaw: "Parking",
        amount: 12.5,
        direction: "INCOME",
        currency: "EUR",
      },
    ]);
  });

  it("rejects files without the required booking date and amount columns", () => {
    const csv = ["purpose;counterparty", "Lunch;Cafe"].join("\n");

    expect(() => parseTransactionCsv(csv)).toThrow(/required columns/i);
  });
});
