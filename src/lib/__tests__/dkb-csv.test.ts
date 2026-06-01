import { describe, it, expect } from 'vitest';
import { parseGermanAmount, parseDkbDate, parseDkbCsv } from '../dkb-csv';

describe('parseGermanAmount', () => {
  it('parses thousands and decimal comma into integer cents', () => {
    expect(parseGermanAmount('1.234,56')).toBe(123456);
  });
  it('parses negative amounts', () => {
    expect(parseGermanAmount('-1.234,56')).toBe(-123456);
  });
  it('parses a plain decimal', () => {
    expect(parseGermanAmount('3,00')).toBe(300);
  });
  it('ignores a trailing currency suffix', () => {
    expect(parseGermanAmount('1.000,00 EUR')).toBe(100000);
  });
});

describe('parseDkbDate', () => {
  it('expands a two-digit year', () => {
    expect(parseDkbDate('01.06.25')).toBe('2025-06-01');
  });
  it('keeps a four-digit year', () => {
    expect(parseDkbDate('09.12.2026')).toBe('2026-12-09');
  });
});

const SAMPLE = [
  '"Girokonto";"DE30 1203 0000 1030 2931 44";',
  '"";',
  '"Kontostand vom 31.05.2026:";"1.909,08 EUR";',
  '"";',
  '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"',
  '"15.01.25";"15.01.25";"Gebucht";"";"REWE SAGT DANKE";"Einkauf Lebensmittel";"Ausgang";"DE12500105170648489890";"-42,50";"";"";""',
  '"31.01.25";"31.01.25";"Gebucht";"ARBEITGEBER GMBH";"";"Lohn/Gehalt 01/25";"Eingang";"DE99500105170123456789";"3.146,25";"";"";""',
  '"05.02.25";"05.02.25";"Gebucht";"";"Eigenuebertrag";"Umbuchung";"Ausgang";"DE62120300001021068935";"-500,00";"";"";""',
  '"06.02.25";"06.02.25";"Gebucht";"";"NULLBUCHUNG";"ignorier mich";"Ausgang";"DE000";"0,00";"";"";""',
].join('\n');

describe('parseDkbCsv', () => {
  const r = parseDkbCsv(SAMPLE);

  it('extracts the account IBAN from the header, stripped of spaces', () => {
    expect(r.iban).toBe('DE30120300001030293144');
  });
  it('extracts the Kontostand balance in cents and its date', () => {
    expect(r.balanceCents).toBe(190908);
    expect(r.balanceDate).toBe('2026-05-31');
  });
  it('skips metadata, the header row and zero-amount rows', () => {
    expect(r.rows).toHaveLength(3);
  });
  it('maps an outgoing row (payee in counterparty, negative cents)', () => {
    const rewe = r.rows[0];
    expect(rewe.bookingDate).toBe('2025-01-15');
    expect(rewe.counterparty).toBe('REWE SAGT DANKE');
    expect(rewe.payer).toBe('');
    expect(rewe.purpose).toBe('Einkauf Lebensmittel');
    expect(rewe.type).toBe('Ausgang');
    expect(rewe.amountCents).toBe(-4250);
    expect(rewe.counterpartyIban).toBe('DE12500105170648489890');
  });
  it('maps an incoming row keeping the payer (Auftraggeber)', () => {
    const salary = r.rows[1];
    expect(salary.payer).toBe('ARBEITGEBER GMBH');
    expect(salary.counterparty).toBe('');
    expect(salary.amountCents).toBe(314625);
    expect(salary.type).toBe('Eingang');
  });
  it('handles a BOM at the start of the file', () => {
    const withBom = '﻿' + SAMPLE;
    expect(parseDkbCsv(withBom).rows).toHaveLength(3);
  });
});
