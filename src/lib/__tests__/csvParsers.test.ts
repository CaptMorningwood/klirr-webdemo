import { describe, expect, it } from 'vitest';
import { decodeTextBuffer } from '../fileDecoding';
import { detectBank, guessMapping, parseCsvToRows, readCsvTable } from '../csvParsers';

const genericCsvFixture = `Datum,Beskrivning,Belopp\n2026-01-25,LÖN Exempel AB,35000\n2026-01-26,ICA Nära,-350,50`;
const swedbankCsvFixture = `Kontoutdrag\nSkapat;2026-01-02\nRadnummer;Clearingnummer;Kontonummer;Produkt;Valuta;Bokföringsdag;Transaktionsdag;Valutadag;Referens;Beskrivning;Belopp;Bokfört saldo\n1;8327;123456789;Privatkonto;SEK;2026-01-05;2026-01-05;2026-01-05;;Försäkring Allmän;-123,45;1000,00`;
const sebCsvFixture = `Bokföringsdatum;Valutadatum;Text;Belopp;Saldo;Verifikationsnummer\n2026-02-01;2026-02-01;Hyra februari;-12000,00;1000,00;A1`;
const handelsbankenCsvFixture = `Bokföringsdag;Transaktionsdag;Text;Belopp;Saldo\n2026-03-01;2026-03-01;Bredband2;-499,00;5000,00`;
const nordeaCsvFixture = `Booking Date;Value Date;Transaction Text;Amount;Balance\n2026-04-01;2026-04-01;Barnbidrag;2650.00;8000.00`;

describe('csvParsers bank-agnostic import pipeline', () => {
  it('finds Swedbank header after metadata and does not use row number as date or amount', () => {
    const table = readCsvTable(swedbankCsvFixture);
    const rows = parseCsvToRows(swedbankCsvFixture, 'swedbank');

    expect(table.headers[0]).toBe('Radnummer');
    expect(rows[0]).toMatchObject({ date: '2026-01-05', description: 'Försäkring Allmän', amount: -123.45, sourceBank: 'swedbank', balanceAfter: 1000 });
  });

  it('detects bank-like fixtures and normalizes rows to canonical parsed rows', () => {
    expect(detectBank(genericCsvFixture)).toBe('generic');
    expect(detectBank(swedbankCsvFixture)).toBe('swedbank');
    expect(detectBank(sebCsvFixture)).toBe('seb');
    expect(detectBank(handelsbankenCsvFixture)).toBe('handelsbanken');
    expect(detectBank(nordeaCsvFixture)).toBe('nordea');

    expect(parseCsvToRows(genericCsvFixture, 'generic')[0]).toMatchObject({ date: '2026-01-25', description: 'LÖN Exempel AB', amount: 35000, sourceBank: 'generic' });
    expect(parseCsvToRows(sebCsvFixture, 'seb')[0]).toMatchObject({ date: '2026-02-01', description: 'Hyra februari', amount: -12000, sourceBank: 'seb' });
    expect(parseCsvToRows(handelsbankenCsvFixture, 'handelsbanken')[0]).toMatchObject({ date: '2026-03-01', description: 'Bredband2', amount: -499, sourceBank: 'handelsbanken' });
    expect(parseCsvToRows(nordeaCsvFixture, 'nordea')[0]).toMatchObject({ date: '2026-04-01', description: 'Barnbidrag', amount: 2650, sourceBank: 'nordea' });
  });

  it('guesses date, description and amount columns using aliases', () => {
    const table = readCsvTable(nordeaCsvFixture, 'nordea');
    expect(guessMapping(table.headers)).toEqual({ date: 'Booking Date', description: 'Transaction Text', amount: 'Amount' });
  });

  it('decodes Windows-1252/Latin Swedish characters without replacement characters', () => {
    const bytes = new Uint8Array([70, 246, 114, 115, 228, 107, 114, 105, 110, 103, 32, 65, 108, 108, 109, 228, 110]);
    const decoded = decodeTextBuffer(bytes.buffer);
    expect(decoded.text).toBe('Försäkring Allmän');
    expect(decoded.encoding).toBe('windows-1252');
    expect(decoded.hadReplacementCharacters).toBe(false);
  });
});
