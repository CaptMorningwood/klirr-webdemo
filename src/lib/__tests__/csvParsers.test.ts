import { describe, expect, it } from 'vitest';
import { parseCsvToRows, readCsvTable } from '../csvParsers';

describe('csvParsers', () => {
  it('finds Swedbank header after metadata and does not use row number as date or amount', () => {
    const csv = `Kontoutdrag\nSkapat;2026-01-02\nRadnummer;Clearingnummer;Kontonummer;Produkt;Valuta;Bokföringsdag;Transaktionsdag;Valutadag;Referens;Beskrivning;Belopp;Bokfört saldo\n1;8327;123456789;Privatkonto;SEK;2026-01-05;2026-01-05;2026-01-05;;ICA SUPERMARKET;-123,45;1000,00`;
    const table = readCsvTable(csv);
    const rows = parseCsvToRows(csv, 'swedbank');

    expect(table.headers[0]).toBe('Radnummer');
    expect(rows).toEqual([{ date: '2026-01-05', description: 'ICA SUPERMARKET', amount: -123.45 }]);
  });
});
