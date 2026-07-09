import type { Transaction } from '../types';
import { uid } from './format';

export type BankKey = 'auto' | 'generic' | 'swedbank' | 'seb' | 'handelsbanken' | 'nordea';

export interface ParsedRow {
  date: string;
  description: string;
  amount: number;
}

function splitLine(line: string, delim: string) {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuotes && next === '"') { cur += '"'; i += 1; }
    else if (ch === '"') inQuotes = !inQuotes;
    else if (ch === delim && !inQuotes) { out.push(cur.trim().replace(/^"|"$/g, '')); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim().replace(/^"|"$/g, ''));
  return out;
}

function toIsoDate(raw: string) {
  const s = (raw || '').trim().replace(/"/g, '');
  const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = s.match(/^(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return s;
}

function toAmount(raw: string) {
  const s = (raw || '').replace(/"/g, '').replace(/\s/g, '').trim();
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) return Number(s.replace(/\./g, '').replace(',', '.'));
  return Number(s.replace(/,/g, ''));
}

function headerIndex(headers: string[], alternatives: string[]) {
  const low = headers.map(h => h.toLowerCase().trim());
  return low.findIndex(h => alternatives.some(a => h.includes(a)));
}

function delimiterScore(line: string, delimiter: string) {
  return splitLine(line, delimiter).length;
}

function detectDelimiter(line: string) {
  const candidates = [';', '\t', ','];
  return candidates
    .map(delimiter => ({ delimiter, score: delimiterScore(line, delimiter) }))
    .sort((a, b) => b.score - a.score)[0]?.delimiter || ',';
}

function looksLikeHeader(headers: string[]) {
  const joined = headers.join(' ').toLowerCase();
  const hasAmount = /(belopp|amount|summa|uttag|insättning)/i.test(joined);
  const hasDate = /(datum|date|bokför|bokf|transaktionsdag|valutadag|booking)/i.test(joined);
  const hasText = /(beskrivning|description|text|mottagare|namn|avsändare|referens)/i.test(joined);
  const isSwedbank = /(radnummer|clearingnummer|kontonummer)/i.test(joined) && hasAmount;
  return isSwedbank || (hasAmount && (hasDate || hasText));
}

function findCsvHeader(lines: string[]) {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const delimiter = detectDelimiter(line);
    const headers = splitLine(line, delimiter);
    if (headers.length > 1 && looksLikeHeader(headers)) return { index, delimiter, headers };
  }
  const delimiter = detectDelimiter(lines[0] || '');
  return { index: 0, delimiter, headers: splitLine(lines[0] || '', delimiter) };
}

export const BANK_FORMATS: { key: BankKey; label: string }[] = [
  { key: 'auto', label: 'Auto-detektera' },
  { key: 'generic', label: 'Generiskt CSV' },
  { key: 'swedbank', label: 'Swedbank' },
  { key: 'seb', label: 'SEB' },
  { key: 'handelsbanken', label: 'Handelsbanken' },
  { key: 'nordea', label: 'Nordea' },
];

export function detectBank(text: string): Exclude<BankKey, 'auto'> {
  const sample = text.split(/\r?\n/).slice(0, 30).join(' ').toLowerCase();
  if (sample.includes('clearingnummer') || sample.includes('kontonummer') || sample.includes('bokfört saldo') || sample.includes('bokf�rt saldo') || sample.includes('transaktionsdag')) return 'swedbank';
  if (sample.includes('verifikationsnummer') || (sample.includes('bokföringsdatum') && sample.includes('saldo'))) return 'seb';
  if (sample.includes('text') && sample.includes('saldo') && sample.includes(';')) return 'handelsbanken';
  if (sample.includes('booking date') || sample.includes('bokföringsdag')) return 'nordea';
  return 'generic';
}

export function parseCsvToRows(text: string, bankKey: BankKey = 'auto'): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const key = bankKey === 'auto' ? detectBank(text) : bankKey;
  const headerInfo = findCsvHeader(lines);
  const header = headerInfo.headers;
  const lowerHeader = header.join(' ').toLowerCase();
  const hasHeader = looksLikeHeader(header) || /(datum|date|belopp|amount|beskrivning|description|text|bokför|bokf|transaktionsdag)/i.test(lowerHeader);

  const dateIdx = headerIndex(header, ['bokföringsdag', 'bokf�ringsdag', 'bokf', 'transaktionsdag', 'valutadag', 'datum', 'date', 'bokföringsdatum', 'booking date']);
  const descIdx = headerIndex(header, ['beskrivning', 'description', 'text', 'mottagare', 'namn', 'avsändare', 'avs�ndare', 'referens']);
  const amountIdx = headerIndex(header, ['belopp', 'amount', 'summa', 'uttag', 'insättning', 'ins�ttning']);

  const out: ParsedRow[] = [];
  const start = hasHeader ? headerInfo.index + 1 : 0;

  for (const line of lines.slice(start)) {
    const p = splitLine(line, headerInfo.delimiter);
    let date = '';
    let description = '';
    let amount = NaN;

    const isSwedbankRowNumberExport = key === 'swedbank' && /radnummer/i.test(header[0] || '') && p.length >= 11;
    if (isSwedbankRowNumberExport) {
      date = toIsoDate(p[5] || p[6]);
      description = p[9] || p[8];
      amount = toAmount(p[10]);
    } else if (dateIdx >= 0 && descIdx >= 0 && amountIdx >= 0) {
      date = toIsoDate(p[dateIdx]);
      description = p[descIdx];
      amount = toAmount(p[amountIdx]);
    } else if (key === 'swedbank' && p.length >= 11) {
      date = toIsoDate(p[6] || p[5]);
      description = p[9] || p[8];
      amount = toAmount(p[10]);
    } else {
      date = toIsoDate(p[0]);
      description = p[1] || p[2] || '';
      amount = toAmount(p[2] || p[3] || '');
    }

    if (date && description && Number.isFinite(amount)) out.push({ date, description: description.trim(), amount });
  }
  return out;
}

export interface CsvTable {
  delimiter: string;
  headers: string[];
  records: string[][];
  hasHeader: boolean;
}

export function readCsvTable(text: string): CsvTable {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const headerInfo = findCsvHeader(lines);
  const hasHeader = looksLikeHeader(headerInfo.headers);
  const headers = hasHeader ? headerInfo.headers : headerInfo.headers.map((_, i) => `Kolumn ${i + 1}`);
  const records = lines.slice(hasHeader ? headerInfo.index + 1 : 0).map(line => splitLine(line, headerInfo.delimiter));
  return { delimiter: headerInfo.delimiter, headers, records, hasHeader };
}

export function guessMapping(headers: string[]): { date: string; description: string; amount: string } {
  const dateIdx = headerIndex(headers, ['bokföringsdag', 'bokf�ringsdag', 'bokf', 'transaktionsdag', 'valutadag', 'datum', 'date', 'bokföringsdatum', 'booking date']);
  const descIdx = headerIndex(headers, ['beskrivning', 'description', 'text', 'mottagare', 'namn', 'avsändare', 'avs�ndare', 'referens']);
  const amountIdx = headerIndex(headers, ['belopp', 'amount', 'summa', 'uttag', 'insättning', 'ins�ttning']);
  return {
    date: headers[Math.max(0, dateIdx)] || headers[0] || '',
    description: headers[Math.max(0, descIdx)] || headers[1] || headers[0] || '',
    amount: headers[Math.max(0, amountIdx)] || headers[2] || headers[headers.length - 1] || '',
  };
}

export function parseRowsWithMapping(text: string, mapping: { date: string; description: string; amount: string }): ParsedRow[] {
  const table = readCsvTable(text);
  const d = table.headers.indexOf(mapping.date);
  const tx = table.headers.indexOf(mapping.description);
  const a = table.headers.indexOf(mapping.amount);
  if (d < 0 || tx < 0 || a < 0) return [];
  const out: ParsedRow[] = [];
  for (const record of table.records) {
    const date = toIsoDate(record[d]);
    const description = (record[tx] || '').trim();
    const amount = toAmount(record[a]);
    if (date && description && Number.isFinite(amount)) out.push({ date, description, amount });
  }
  return out;
}

export function transactionFingerprint(t: Pick<Transaction, 'date' | 'description' | 'amount' | 'accountId'>) {
  return `${t.accountId}|${t.date}|${t.description.toLowerCase().replace(/\s+/g, ' ').trim()}|${Math.round(t.amount * 100)}`;
}

export function rowsToTransactions(rows: ParsedRow[], accountId: string): Transaction[] {
  return rows.map(r => ({ id: uid('tx'), accountId, date: r.date, description: r.description, amount: r.amount }));
}

export function csvEscape(v: string | number) {
  const s = String(v ?? '');
  if (/[;",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
