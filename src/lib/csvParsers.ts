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
    if (ch === '"') inQuotes = !inQuotes;
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

export const BANK_FORMATS: { key: BankKey; label: string }[] = [
  { key: 'auto', label: 'Auto-detektera' },
  { key: 'generic', label: 'Generiskt CSV' },
  { key: 'swedbank', label: 'Swedbank' },
  { key: 'seb', label: 'SEB' },
  { key: 'handelsbanken', label: 'Handelsbanken' },
  { key: 'nordea', label: 'Nordea' },
];

export function detectBank(text: string): Exclude<BankKey, 'auto'> {
  const first = text.split(/\r?\n/).find(Boolean)?.toLowerCase() || '';
  if (first.includes('bokfört saldo') || first.includes('transaktionsdag') || first.includes('clearingnummer')) return 'swedbank';
  if (first.includes('verifikationsnummer') || (first.includes('bokföringsdatum') && first.includes('saldo'))) return 'seb';
  if (first.includes('text') && first.includes('saldo') && first.includes(';')) return 'handelsbanken';
  if (first.includes('booking date') || first.includes('bokföringsdag')) return 'nordea';
  return 'generic';
}

export function parseCsvToRows(text: string, bankKey: BankKey = 'auto'): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const key = bankKey === 'auto' ? detectBank(text) : bankKey;
  const delim = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const header = splitLine(lines[0], delim);
  const lowerHeader = header.join(' ').toLowerCase();
  const hasHeader = /(datum|date|belopp|amount|beskrivning|description|text)/i.test(lowerHeader);

  const dateIdx = headerIndex(header, ['datum', 'date', 'bokföringsdag', 'bokföringsdatum', 'transaktionsdag', 'booking date']);
  const descIdx = headerIndex(header, ['beskrivning', 'description', 'text', 'mottagare', 'namn', 'avsändare']);
  const amountIdx = headerIndex(header, ['belopp', 'amount', 'summa']);

  const out: ParsedRow[] = [];
  const start = hasHeader ? 1 : 0;

  for (const line of lines.slice(start)) {
    const p = splitLine(line, delim);
    let date = '';
    let description = '';
    let amount = NaN;

    if (dateIdx >= 0 && descIdx >= 0 && amountIdx >= 0) {
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

export function rowsToTransactions(rows: ParsedRow[], accountId: string): Transaction[] {
  return rows.map(r => ({ id: uid('tx'), accountId, date: r.date, description: r.description, amount: r.amount }));
}

export function csvEscape(v: string | number) {
  const s = String(v ?? '');
  if (/[;",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
