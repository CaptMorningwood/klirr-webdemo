import type { Income } from '../types';

export type IncomeTargetStrategy = 'add_new' | 'update_single' | 'suggest_existing' | 'needs_user_choice';

export interface IncomeTargetResult {
  strategy: IncomeTargetStrategy;
  incomeId?: string;
  candidateIncomes?: Income[];
  reason: string;
}

const SALARY_LABELS = ['lön', 'lon', 'salary', 'arbete', 'arbetsgivare', 'månadsinkomst', 'manadsinkomst', 'jobb'];
const SUPPORT_LABELS = ['barnbidrag', 'bidrag', 'csn', 'pension', 'försäkringskassan', 'forsakringskassan', 'sjukpenning', 'föräldrapenning', 'foraldrapenning', 'vab'];

function normalized(label: string) {
  return label.toLowerCase().trim();
}

export function isSalaryLikeIncome(income: Income) {
  const label = normalized(income.label);
  return SALARY_LABELS.some(word => label.includes(word));
}

export function isSupportLikeIncome(income: Income) {
  const label = normalized(income.label);
  return SUPPORT_LABELS.some(word => label.includes(word));
}

export function selectIncomeTargetForSalaryUpdate(incomes: Income[] = [], _message = ''): IncomeTargetResult {
  if (incomes.length === 0) return { strategy: 'add_new', reason: 'Det finns ingen inkomst ännu, så ny nettolön kan läggas till.' };
  if (incomes.length === 1) return { strategy: 'update_single', incomeId: incomes[0].id, candidateIncomes: incomes, reason: 'Det finns exakt en inkomst, så den kan uppdateras utan dubblett.' };

  const salaryCandidates = incomes.filter(income => isSalaryLikeIncome(income) && !isSupportLikeIncome(income));
  if (salaryCandidates.length === 1) {
    return { strategy: 'suggest_existing', incomeId: salaryCandidates[0].id, candidateIncomes: salaryCandidates, reason: `Hittade en tydlig lönepost: ${salaryCandidates[0].label}.` };
  }

  const nonSupport = incomes.filter(income => !isSupportLikeIncome(income));
  return {
    strategy: 'needs_user_choice',
    candidateIncomes: nonSupport.length ? nonSupport : incomes,
    reason: salaryCandidates.length > 1 ? 'Flera inkomster liknar lön, så användaren behöver välja.' : 'Flera inkomster finns och ingen är en entydig lönepost.',
  };
}
