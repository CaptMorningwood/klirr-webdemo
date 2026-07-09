import type { Transaction } from '../types';
import { uid } from './format';
import { BANK_FORMAT_DEFINITIONS, BANK_FORMATS, bankFormatByKey, canonicalHeader, findColumnIndex, type BankKey } from './bankFormats';

export type { BankKey } from './bankFormats';
export { BANK_FORMATS } from './bankFormats';

export interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  originalDescription?: string;
  counterparty?: string;
  bankReference?: string;
  balanceAfter?: number;
  raw?: Record<string, unknown>;
  sourceBank?: Exclude<BankKey, 'auto'>;
  importWarnings?: string[];
}

export interface CsvTable {
  delimiter: string;
  headers: string[];
  records: string[][];
  hasHeader: boolean;
  headerIndex: number;
  detectedBank: Exclude<BankKey, 'auto'>;
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
  const m3 = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;
  return s;
}

function toAmount(raw: string) {
  const s = (raw || '').replace(/"/g, '').replace(/\s/g, '').replace(/kr$/i, '').trim();
  if (!s) return NaN;
  const negative = /^-/.test(s) || /^\(.+\)$/.test(s);
  const cleaned = s.replace(/[()]/g, '').replace(/^[-+]/, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const numeric = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  const amount = Number(numeric);
  return negative ? -amount : amount;
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

function rowLooksLikeHeader(headers: string[]) {
  const joined = headers.map(canonicalHeader).join(' ');
  const hasAmount = /(belopp|amount|summa|uttag|insättning|insattning)/i.test(joined);
  const hasDate = /(datum|date|bokför|bokfor|bokf|transaktionsdag|valutadag|booking)/i.test(joined);
  const hasText = /(beskrivning|description|text|mottagare|namn|avsändare|avsandare|referens|transaction)/i.test(joined);
  return hasAmount && (hasDate || hasText);
}

function findCsvHeader(lines: string[]) {
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const delimiter = detectDelimiter(line);
    const headers = splitLine(line, delimiter);
    if (headers.length > 1 && rowLooksLikeHeader(headers)) return { index, delimiter, headers, hasHeader: true };
  }
  const delimiter = detectDelimiter(lines[0] || '');
  return { index: 0, delimiter, headers: splitLine(lines[0] || '', delimiter), hasHeader: false };
}

export function detectBank(text: string): Exclude<BankKey, 'auto'> {
  const sample = text.split(/\r?\n/).slice(0, 40).join(' ').toLowerCase();
  const normalized = canonicalHeader(sample);
  const scores = BANK_FORMAT_DEFINITIONS.filter(format => format.key !== 'generic').map(format => ({
    key: format.key,
    score: format.headerMatchers.filter(matcher => normalized.includes(canonicalHeader(matcher))).length,
  })).sort((a, b) => b.score - a.score);
  return scores[0]?.score ? scores[0].key : 'generic';
}

export function readCsvTable(text: string, bankKey: BankKey = 'auto'): CsvTable {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const detectedBank = bankKey === 'auto' ? detectBank(text) : bankKey;
  const headerInfo = findCsvHeader(lines);
  const hasHeader = headerInfo.hasHeader;
  const headers = hasHeader ? headerInfo.headers : headerInfo.headers.map((_, i) => `Kolumn ${i + 1}`);
  const records = lines.slice(hasHeader ? headerInfo.index + 1 : 0).map(line => splitLine(line, headerInfo.delimiter));
  return { delimiter: headerInfo.delimiter, headers, records, hasHeader, headerIndex: headerInfo.index, detectedBank };
}

function normalizeRow(record: string[], headers: string[], bankKey: Exclude<BankKey, 'auto'>): ParsedRow | null {
  const format = bankFormatByKey(bankKey);
  const raw = Object.fromEntries(headers.map((header, index) => [header, record[index] ?? '']));
  const warnings: string[] = [];

  const dateIdx = findColumnIndex(headers, format.columnAliases.date);
  const descIdx = findColumnIndex(headers, format.columnAliases.description);
  const amountIdx = findColumnIndex(headers, format.columnAliases.amount);
  const balanceIdx = findColumnIndex(headers, format.columnAliases.balance || []);
  const counterpartyIdx = findColumnIndex(headers, format.columnAliases.counterparty || []);
  const referenceIdx = findColumnIndex(headers, format.columnAliases.reference || []);

  let date = dateIdx >= 0 ? toIsoDate(record[dateIdx]) : '';
  let description = descIdx >= 0 ? (record[descIdx] || '').trim() : '';
  let amount = amountIdx >= 0 ? toAmount(record[amountIdx]) : NaN;

  const isSwedbankRowNumberExport = bankKey === 'swedbank' && /radnummer/i.test(headers[0] || '') && record.length >= 11;
  if (isSwedbankRowNumberExport) {
    date = toIsoDate(record[5] || record[6]);
    description = (record[9] || record[8] || '').trim();
    amount = toAmount(record[10]);
  } else if (!date || !description || !Number.isFinite(amount)) {
    date ||= toIsoDate(record[0]);
    description ||= (record[1] || record[2] || '').trim();
    amount = Number.isFinite(amount) ? amount : toAmount(record[2] || record[3] || '');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) warnings.push('invalid_date');
  if (!description) warnings.push('missing_description');
  if (!Number.isFinite(amount)) warnings.push('invalid_amount');
  if (warnings.some(w => ['invalid_date', 'missing_description', 'invalid_amount'].includes(w))) return null;

  return {
    date,
    description,
    amount,
    originalDescription: description,
    counterparty: counterpartyIdx >= 0 ? record[counterpartyIdx] : undefined,
    bankReference: referenceIdx >= 0 ? record[referenceIdx] : undefined,
    balanceAfter: balanceIdx >= 0 ? toAmount(record[balanceIdx]) : undefined,
    raw,
    sourceBank: bankKey,
    importWarnings: warnings,
  };
}

export function parseCsvToRows(text: string, bankKey: BankKey = 'auto'): ParsedRow[] {
  const table = readCsvTable(text, bankKey);
  return table.records.map(record => normalizeRow(record, table.headers, table.detectedBank)).filter((row): row is ParsedRow => Boolean(row));
}

export function guessMapping(headers: string[]): { date: string; description: string; amount: string } {
  const generic = bankFormatByKey('generic');
  const dateIdx = findColumnIndex(headers, generic.columnAliases.date);
  const descIdx = findColumnIndex(headers, generic.columnAliases.description);
  const amountIdx = findColumnIndex(headers, generic.columnAliases.amount);
  return {
    date: headers[Math.max(0, dateIdx)] || headers[0] || '',
    description: headers[Math.max(0, descIdx)] || headers[1] || headers[0] || '',
    amount: headers[Math.max(0, amountIdx)] || headers[2] || headers[headers.length - 1] || '',
  };
}

export function parseRowsWithMapping(text: string, mapping: { date: string; description: string; amount: string }, bankKey: BankKey = 'auto'): ParsedRow[] {
  const table = readCsvTable(text, bankKey);
  const d = table.headers.indexOf(mapping.date);
  const tx = table.headers.indexOf(mapping.description);
  const a = table.headers.indexOf(mapping.amount);
  if (d < 0 || tx < 0 || a < 0) return [];
  const out: ParsedRow[] = [];
  for (const record of table.records) {
    const date = toIsoDate(record[d]);
    const description = (record[tx] || '').trim();
    const amount = toAmount(record[a]);
    if (date && description && Number.isFinite(amount)) out.push({ date, description, amount, originalDescription: description, raw: Object.fromEntries(table.headers.map((header, index) => [header, record[index] ?? ''])), sourceBank: table.detectedBank });
  }
  return out;
}

export function transactionFingerprint(t: Pick<Transaction, 'date' | 'description' | 'amount' | 'accountId'>) {
  return `${t.accountId}|${t.date}|${t.description.toLowerCase().replace(/\s+/g, ' ').trim()}|${Math.round(t.amount * 100)}`;
}

export function rowsToTransactions(rows: ParsedRow[], accountId: string): Transaction[] {
  return rows.map(r => ({
    id: uid('tx'),
    accountId,
    date: r.date,
    description: r.description,
    amount: r.amount,
    originalDescription: r.originalDescription,
    counterparty: r.counterparty,
    bankReference: r.bankReference,
    balanceAfter: r.balanceAfter,
    raw: r.raw,
    sourceBank: r.sourceBank,
    importWarnings: r.importWarnings,
  }));
}

export function csvEscape(v: string | number) {
  const s = String(v ?? '');
  if (/[;",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
