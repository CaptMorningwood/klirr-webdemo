import type { AppState, BudgetSummary, DetectionResult } from '../types';

export type BudgetCompletionKey = 'household' | 'income' | 'musts' | 'variablePlan' | 'checkup';

export interface BudgetCompletionItem {
  key: BudgetCompletionKey;
  label: string;
  completed: boolean;
}

export interface BudgetCompletion {
  percentage: number;
  completedItems: BudgetCompletionItem[];
  missingItems: BudgetCompletionItem[];
  items: BudgetCompletionItem[];
}

export function calculateBudgetCompletion(input: { state: AppState; summary: BudgetSummary; detection?: DetectionResult; handledReviewCount?: number; visibleReviewCount?: number }): BudgetCompletion {
  const { state, summary } = input;
  const hasConfirmedRecurringFixed = Object.values(state.recurringDecisions || {}).some(d => d.status === 'confirmed' && d.costType !== 'income' && d.costType !== 'variable');
  const hasCheckup = (state.buddyActionHistory || []).some(entry => entry.actionType === 'run_budget_checkup' || /checkup|städa|onboarding-budget/i.test(entry.message || ''));
  const noCriticalIssues = (input.visibleReviewCount || 0) === 0 && summary.warnings.length === 0;
  const items: BudgetCompletionItem[] = [
    { key: 'household', label: 'Hushåll', completed: Boolean(state.householdProfile) },
    { key: 'income', label: 'Inkomst', completed: summary.totalIncome > 0 },
    { key: 'musts', label: 'Måsten', completed: summary.fixedTotal > 0 || hasConfirmedRecurringFixed },
    { key: 'variablePlan', label: 'Rörlig Budget', completed: state.variablePlan.some(item => item.include !== false && item.amount > 0) },
    { key: 'checkup', label: 'Budget Checkup', completed: hasCheckup || noCriticalIssues },
  ];
  const completedItems = items.filter(item => item.completed);
  const missingItems = items.filter(item => !item.completed);
  return { percentage: Math.round((completedItems.length / items.length) * 100), completedItems, missingItems, items };
}
