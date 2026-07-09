import { describe, expect, it } from 'vitest';
import { calculateBudget } from '../budgetCalculator';
import { detectPossibleIncomeDuplicates, getUnifiedIncomeItems } from '../incomeReconciliation';
import type { DetectionResult } from '../../types';

const detectionWithSalary: DetectionResult = {
  transfers: [],
  reviewItems: [],
  recurring: [{
    id: 'rec_salary', normName: 'lon', label: 'LÖN', category: 'Lön', costTypeDefault: 'income', frequency: 'monthly', occurrences: 3, monthlyAmount: 27617, meanAmount: 27617, minAmount: 27617, maxAmount: 27617, amountVaries: false, confidence: 95, lastDate: '2026-06-25', txIds: [], reason: 'Månadsvis pluspost',
  }],
};

describe('income reconciliation', () => {
  it('includes confirmed recurring income in unified income items', () => {
    const summary = calculateBudget({ detection: detectionWithSalary, recurringDecisions: { rec_salary: { status: 'confirmed' } }, incomes: [], manualExpenses: [], variablePlan: [] });
    const unified = getUnifiedIncomeItems(summary, []);

    expect(summary.totalIncome).toBe(27617);
    expect(unified).toContainEqual(expect.objectContaining({ id: 'rec_salary', label: 'LÖN', source: 'recurring', amount: 27617 }));
  });

  it('warns when manual and recurring salary may duplicate each other', () => {
    const summary = calculateBudget({ detection: { ...detectionWithSalary, recurring: [{ ...detectionWithSalary.recurring[0], monthlyAmount: 35000 }] }, recurringDecisions: { rec_salary: { status: 'confirmed' } }, incomes: [{ id: 'manual_salary', label: 'Alex lön', amount: 34000, frequency: 'monthly' }], manualExpenses: [], variablePlan: [] });
    const duplicates = detectPossibleIncomeDuplicates([{ id: 'manual_salary', label: 'Alex lön', amount: 34000, frequency: 'monthly' }], summary.incomeItems.filter(item => item.source === 'recurring'));

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].reasons.length).toBeGreaterThan(0);
  });
});
