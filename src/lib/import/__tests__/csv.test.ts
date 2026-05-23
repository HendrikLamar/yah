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

  it("strips a UTF-8 BOM before parsing", () => {
    const csv =
      "﻿Buchungstag;Verwendungszweck;Betrag (EUR)\n02.05.2026;Lunch;-12,50";

    const parsed = parseTransactionCsv(csv);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      bookingDate: "2026-05-02",
      purposeRaw: "Lunch",
      amount: -12.5,
    });
  });

  it("skips preamble lines and finds the header further down", () => {
    const csv = [
      '"Girokonto";"DE00 0000 0000 0000 0000 00";"01.05.2026"',
      '"Kontostand vom 01.05.2026:";"1.234,56 EUR"',
      "",
      "Buchungsdatum;Wertstellung;Verwendungszweck;Betrag (€)",
      '02.05.2026;02.05.2026;Lunch;-12,50',
    ].join("\n");

    const parsed = parseTransactionCsv(csv);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      bookingDate: "2026-05-02",
      purposeRaw: "Lunch",
      amount: -12.5,
    });
  });

  it("derives counterparty from payer/payee columns based on direction", () => {
    const csv = [
      "Buchungsdatum;Zahlungspflichtige*r;Zahlungsempfänger*in;Verwendungszweck;Betrag (€)",
      '02.05.2026;HENDRIK WINDEL;REWE BERLIN;Wocheneinkauf;-84,21',
      '03.05.2026;ARBEITGEBER GMBH;HENDRIK WINDEL;Salary May;3200,00',
    ].join("\n");

    const parsed = parseTransactionCsv(csv);

    expect(parsed[0]).toMatchObject({
      direction: "EXPENSE",
      counterpartyName: "REWE BERLIN",
    });
    expect(parsed[1]).toMatchObject({
      direction: "INCOME",
      counterpartyName: "ARBEITGEBER GMBH",
    });
  });

  it("parses two-digit years as 20xx", () => {
    const csv = [
      "Buchungstag;Verwendungszweck;Betrag (EUR)",
      '02.05.26;Lunch;-12,50',
    ].join("\n");

    const parsed = parseTransactionCsv(csv);

    expect(parsed[0]?.bookingDate).toBe("2026-05-02");
  });

  it("treats dot as a thousand separator in semicolon-separated amounts", () => {
    const csv = [
      "Buchungstag;Verwendungszweck;Betrag (EUR)",
      '02.05.2026;Rent;-1.800',
      '03.05.2026;Bonus;12.345',
    ].join("\n");

    const parsed = parseTransactionCsv(csv);

    expect(parsed[0]?.amount).toBe(-1800);
    expect(parsed[1]?.amount).toBe(12345);
  });
});
