import { describe, expect, it } from 'vitest';
import { calculateBudget } from '../budgetCalculator';

const emptyDetection = { transfers: [], recurring: [], reviewItems: [] };

describe('budgetCalculator manual-only data', () => {
  it('counts manual incomes without transactions', () => {
    const summary = calculateBudget({ detection: emptyDetection, recurringDecisions: {}, incomes: [{ id: 'income_1', label: 'Lön', amount: 30000, frequency: 'monthly' }], manualExpenses: [], variablePlan: [] });
    expect(summary.totalIncome).toBe(30000);
  });

  it('counts manual expenses without transactions', () => {
    const summary = calculateBudget({ detection: emptyDetection, recurringDecisions: {}, incomes: [], manualExpenses: [{ id: 'mx_1', label: 'Hyra', amount: 9000, category: 'Boende', costType: 'fixed', active: true, frequency: 'monthly' }], variablePlan: [] });
    expect(summary.fixedTotal).toBe(9000);
  });
});


it('uses recurring income overrides for label, amount, frequency, and category', () => {
  const detection = {
    transfers: [],
    reviewItems: [],
    recurring: [{ id: 'rec_salary', normName: 'lon', label: 'LÖN', category: 'Lön', costTypeDefault: 'income' as const, frequency: 'monthly' as const, occurrences: 2, monthlyAmount: 18807, meanAmount: 18807, minAmount: 18000, maxAmount: 19614, amountVaries: true, confidence: 80, lastDate: '2026-06-25', txIds: ['tx_1'], reason: 'Månadsvis pluspost' }],
  };

  const summary = calculateBudget({
    detection,
    recurringDecisions: { rec_salary: { status: 'confirmed', costType: 'income', labelOverride: 'Korrigerad lön', monthlyAmountOverride: 27617, frequencyOverride: 'monthly', category: 'Korrigerad kategori' } },
    incomes: [],
    manualExpenses: [],
    variablePlan: [],
  });

  expect(summary.totalIncome).toBe(27617);
  expect(summary.incomeItems).toContainEqual(expect.objectContaining({ id: 'rec_salary', label: 'Korrigerad lön', amount: 27617, frequency: 'monthly', category: 'Korrigerad kategori' }));
});
