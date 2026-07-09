import type { BudgetLine, BudgetSummary, Income } from '../types';

export interface PossibleIncomeDuplicate {
  manual: Income;
  recurring: BudgetLine;
  reasons: string[];
}

function monthlyIncome(income: Income) {
  if (income.frequency === 'yearly') return income.amount / 12;
  if (income.frequency === 'quarterly') return income.amount / 3;
  return income.amount;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSalaryLike(value: string) {
  const normalized = normalizeName(value);
  return /\b(lon|lön|salary|payroll|wage|lonespec|arbetsgivare)\b/.test(normalized);
}

function hasSimilarName(left: string, right: string) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const aWords = new Set(a.split(' ').filter(w => w.length >= 3));
  return b.split(' ').some(w => w.length >= 3 && aWords.has(w));
}

function isWithinTwentyPercent(a: number, b: number) {
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (!max) return false;
  return Math.abs(a - b) / max <= 0.2;
}

export function getUnifiedIncomeItems(summary: BudgetSummary, _incomes: Income[]) {
  return summary.incomeItems;
}

export function detectPossibleIncomeDuplicates(manualIncomes: Income[], recurringIncomeItems: BudgetLine[]): PossibleIncomeDuplicate[] {
  const duplicates: PossibleIncomeDuplicate[] = [];
  for (const manual of manualIncomes) {
    for (const recurring of recurringIncomeItems) {
      const reasons: string[] = [];
      if (hasSimilarName(manual.label, recurring.label)) reasons.push('liknande namn');
      if (isWithinTwentyPercent(monthlyIncome(manual), recurring.amount)) reasons.push('liknande belopp');
      if (isSalaryLike(manual.label) && isSalaryLike(recurring.label)) reasons.push('båda ser ut som lön');
      if (reasons.length) duplicates.push({ manual, recurring, reasons });
    }
  }
  return duplicates;
}
