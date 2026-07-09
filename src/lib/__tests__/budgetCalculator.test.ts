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
