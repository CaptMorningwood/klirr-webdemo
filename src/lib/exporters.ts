import type { Account, BudgetSummary, DetectionResult, Transaction } from '../types';
import { csvEscape } from './csvParsers';
import { fmt } from './format';

export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportTransactionsCsv(transactions: Transaction[], accounts: Account[]) {
  const acc = new Map(accounts.map(a => [a.id, a.name]));
  const lines = ['datum;account;beskrivning;belopp'];
  for (const t of transactions) {
    lines.push([t.date, acc.get(t.accountId) || '', t.description, t.amount].map(csvEscape).join(';'));
  }
  downloadText('klirr-transaktioner.csv', lines.join('\n'), 'text/csv;charset=utf-8');
}

export function exportBudgetReport(summary: BudgetSummary, detection: DetectionResult) {
  const lines = [
    'Klirr månadsrapport',
    '',
    `Inkomster: ${fmt(summary.totalIncome)}`,
    `Fasta utgifter: ${fmt(summary.fixedTotal)}`,
    `Rörlig plan: ${fmt(summary.variablePlanTotal)}`,
    `Total månadsplan: ${fmt(summary.totalMonthlyPlan)}`,
    `Kvar efter plan: ${fmt(summary.remainingAfterPlan)}`,
    '',
    'Fasta kostnader:',
    ...summary.fixedItems.map(i => `- ${i.label}: ${fmt(i.amount)} (${i.category})`),
    '',
    'Rörliga poster:',
    ...summary.variableItems.map(i => `- ${i.label}: ${fmt(i.amount)} (${i.category})`),
    '',
    `Oklara poster: ${detection.reviewItems.length}`,
  ];
  downloadText('klirr-manadsrapport.txt', lines.join('\n'));
}
