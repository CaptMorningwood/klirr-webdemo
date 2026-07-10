import { describe, expect, it } from 'vitest';
import type { AppState, BudgetSummary } from '../../types';
import { calculateBudgetCompletion } from '../budgetCompletion';

const baseState: AppState = { accounts: [], transactions: [], rules: [], incomes: [], manualExpenses: [], variablePlan: [], recurringDecisions: {}, transferDecisions: {}, scenarioOff: [], chatMessages: [], buddyActionHistory: [], onboardingCompleted: false };
const summary: BudgetSummary = { totalIncome: 0, fixedTotal: 0, variablePlanTotal: 0, totalMonthlyPlan: 0, remainingAfterFixed: 0, remainingAfterPlan: 0, fixedItems: [], variableItems: [], activeRecurring: [], incomeItems: [], warnings: [] };

describe('budget completion', () => {
  it('is deterministic and separate from Budget Health', () => {
    const completion = calculateBudgetCompletion({ state: baseState, summary });
    expect(completion.percentage).toBe(20);
    expect(completion.missingItems.map(item => item.label)).toEqual(['Hushåll', 'Inkomst', 'Måsten', 'Rörlig Budget']);
  });

  it('counts setup coverage across income, musts, variable budget and checkup', () => {
    const state: AppState = { ...baseState, householdProfile: { adults: 1, children: 0, teens: 0, pets: 0, foodAmbition: 'normal', transportNeed: 'normal', householdType: 'single' }, variablePlan: [{ id: 'vp', label: 'Mat', amount: 4000, category: 'Vardag', include: true }], buddyActionHistory: [{ id: 'h', createdAt: '2026-01-01', type: 'applied', actionType: 'run_budget_checkup', actionId: 'x' }] };
    const completeSummary = { ...summary, totalIncome: 30000, fixedTotal: 10000 };
    expect(calculateBudgetCompletion({ state, summary: completeSummary }).percentage).toBe(100);
  });
});
