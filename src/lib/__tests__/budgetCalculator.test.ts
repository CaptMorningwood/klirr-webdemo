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

const fixedRecurringDetection = {
  transfers: [],
  reviewItems: [],
  recurring: [{ id: 'rec_rent', normName: 'hyra', label: 'HYRA', category: 'Boende', costTypeDefault: 'fixed' as const, frequency: 'monthly' as const, occurrences: 3, monthlyAmount: 10000, meanAmount: 10000, minAmount: 10000, maxAmount: 10000, amountVaries: false, confidence: 90, lastDate: '2026-06-01', txIds: ['tx_rent'], reason: 'Månadsvis utgift' }],
};

describe('budgetCalculator fixed must edits', () => {
  it('reflects edited manual fixed expenses in the fixed summary', () => {
    const summary = calculateBudget({
      detection: emptyDetection,
      recurringDecisions: {},
      incomes: [],
      manualExpenses: [{ id: 'mx_rent', label: 'Delad hyra', amount: 12000, category: 'Boende', costType: 'fixed', active: true, frequency: 'quarterly' }],
      variablePlan: [],
    });

    expect(summary.fixedTotal).toBe(4000);
    expect(summary.fixedItems).toContainEqual(expect.objectContaining({ id: 'mx_rent', label: 'Delad hyra', amount: 4000, category: 'Boende', source: 'manual', frequency: 'quarterly' }));
  });

  it('uses overrides for imported recurring fixed expenses without changing their source', () => {
    const summary = calculateBudget({
      detection: fixedRecurringDetection,
      recurringDecisions: { rec_rent: { status: 'confirmed', costType: 'fixed', labelOverride: 'Korrigerad hyra', monthlyAmountOverride: 9500, category: 'Hyra', frequencyOverride: 'yearly' } },
      incomes: [],
      manualExpenses: [],
      variablePlan: [],
    });

    expect(summary.fixedTotal).toBe(9500);
    expect(summary.fixedItems).toContainEqual(expect.objectContaining({ id: 'rec_rent', label: 'Korrigerad hyra', amount: 9500, category: 'Hyra', source: 'recurring', frequency: 'yearly' }));
  });

  it('removes rejected imported recurring fixed expenses from the fixed summary', () => {
    const summary = calculateBudget({
      detection: fixedRecurringDetection,
      recurringDecisions: { rec_rent: { status: 'rejected', costType: 'fixed' } },
      incomes: [],
      manualExpenses: [],
      variablePlan: [],
    });

    expect(summary.fixedTotal).toBe(0);
    expect(summary.fixedItems).toHaveLength(0);
  });

  it('moves imported recurring fixed expenses to variable when cost type is overridden', () => {
    const summary = calculateBudget({
      detection: fixedRecurringDetection,
      recurringDecisions: { rec_rent: { status: 'confirmed', costType: 'variable', monthlyAmountOverride: 9000 } },
      incomes: [],
      manualExpenses: [],
      variablePlan: [],
    });

    expect(summary.fixedTotal).toBe(0);
    expect(summary.variablePlanTotal).toBe(9000);
    expect(summary.variableItems).toContainEqual(expect.objectContaining({ id: 'rec_rent', amount: 9000, source: 'recurring' }));
  });
});
