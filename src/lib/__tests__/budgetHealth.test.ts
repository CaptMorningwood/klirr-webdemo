import { describe, expect, it } from 'vitest';
import { budgetHealthImprovementMessage, budgetHealthNextSteps, budgetHealthShortStatus, calculateBudgetHealth, explainBudgetHealthChange, splitBudgetHealthReasons } from '../budgetHealth';
import type { BudgetSummary } from '../../types';

const baseSummary: BudgetSummary = {
  totalIncome: 30000,
  fixedTotal: 12000,
  variablePlanTotal: 12000,
  totalMonthlyPlan: 24000,
  remainingAfterFixed: 18000,
  remainingAfterPlan: 6000,
  fixedItems: [{ id: 'rent', label: 'Hyra', amount: 12000, category: 'Boende', source: 'manual' }],
  variableItems: [{ id: 'food', label: 'Mat och hushåll', amount: 5000, category: 'Mat', source: 'variablePlan' }, { id: 'buffer', label: 'Buffert/sparande', amount: 2000, category: 'Buffert', source: 'variablePlan' }],
  activeRecurring: [],
  incomeItems: [{ id: 'salary', label: 'Lön', amount: 30000, category: 'Inkomst', source: 'manual' }],
  warnings: [],
};

describe('Budgethälsa', () => {
  it('returns a deterministic explainable score without account balance inputs', () => {
    const first = calculateBudgetHealth({ summary: baseSummary, state: { householdProfile: { adults: 1, children: 0, teens: 0 } } });
    const second = calculateBudgetHealth({ summary: baseSummary, state: { householdProfile: { adults: 1, children: 0, teens: 0 } } });
    expect(second).toEqual(first);
    expect(first.score).toBeGreaterThan(0);
    expect(first.reasons.length).toBeGreaterThan(0);
    expect(JSON.stringify(first).toLowerCase()).not.toContain('account balance');
  });

  it('rewards positive margin and reduces score for negative margin', () => {
    const healthy = calculateBudgetHealth({ summary: baseSummary, state: { householdProfile: { adults: 1, children: 0, teens: 0 } } });
    const negative = calculateBudgetHealth({ summary: { ...baseSummary, variablePlanTotal: 33000, totalMonthlyPlan: 45000, remainingAfterPlan: -15000 }, state: { householdProfile: { adults: 1, children: 0, teens: 0 } } });
    expect(healthy.score).toBeGreaterThan(negative.score);
    expect(negative.reasons.some(r => r.id === 'negative-margin')).toBe(true);
  });

  it('reduces score for duplicate income and unresolved critical review items', () => {
    const clean = calculateBudgetHealth({ summary: baseSummary, state: { householdProfile: { adults: 1, children: 0, teens: 0 } } });
    const risky = calculateBudgetHealth({ summary: baseSummary, state: { householdProfile: { adults: 1, children: 0, teens: 0 } }, possibleIncomeDuplicates: [{}], visibleReviewCount: 10, highSeverityIssueCount: 1 });
    expect(risky.score).toBeLessThan(clean.score);
    expect(risky.reasons.map(r => r.id)).toEqual(expect.arrayContaining(['duplicate-income', 'unresolved-review', 'critical-issues']));
  });

  it('explains score changes after a confirmed change, not a proposed action', () => {
    const before = calculateBudgetHealth({ summary: { ...baseSummary, remainingAfterPlan: 500, variablePlanTotal: 17500, totalMonthlyPlan: 29500 }, state: { householdProfile: { adults: 1, children: 0, teens: 0 } } });
    const proposedOnly = calculateBudgetHealth({ summary: { ...baseSummary, remainingAfterPlan: 500, variablePlanTotal: 17500, totalMonthlyPlan: 29500 }, state: { householdProfile: { adults: 1, children: 0, teens: 0 } } });
    const after = calculateBudgetHealth({ summary: baseSummary, state: { householdProfile: { adults: 1, children: 0, teens: 0 } } });
    expect(proposedOnly.score).toBe(before.score);
    expect(after.score).toBeGreaterThan(before.score);
    expect(explainBudgetHealthChange(before, after)).toContain('Budgethälsan steg');
  });
  it('separates positive and negative reasons and displays signed impacts', () => {
    const result = calculateBudgetHealth({ summary: { ...baseSummary, remainingAfterPlan: 400, variablePlanTotal: 17600, totalMonthlyPlan: 29600 }, state: {} });
    const split = splitBudgetHealthReasons(result.reasons);
    expect(split.positive.every(reason => reason.impact > 0)).toBe(true);
    expect(split.negative.every(reason => reason.impact < 0)).toBe(true);
    expect(split.negative.map(reason => `${reason.impact}`)).toContain('-12');
  });

  it('explains Budget Health as sustainability instead of wealth', () => {
    const result = calculateBudgetHealth({ summary: baseSummary, state: { householdProfile: { adults: 1, children: 0, teens: 0 } } });
    expect(budgetHealthShortStatus(result)).toMatch(/Budgeten/);
    expect('Budgethälsa mäter hur hållbar och stabil din Budget är. Den mäter inte hur rik du är eller hur duktig du är med pengar.').toMatch(/hållbar och stabil/);
    expect('Budgethälsa mäter hur hållbar och stabil din Budget är. Den mäter inte hur rik du är eller hur duktig du är med pengar.').toMatch(/inte hur rik/);
  });

  it('maps strongest negative reasons to practical next steps', () => {
    const risky = calculateBudgetHealth({ summary: { ...baseSummary, fixedTotal: 25000, remainingAfterFixed: 5000, variablePlanTotal: 6000, totalMonthlyPlan: 31000, remainingAfterPlan: -1000, variableItems: [{ id: 'food', label: 'Mat', amount: 6000, category: 'Mat', source: 'variablePlan' }] }, state: {}, possibleIncomeDuplicates: [{}], visibleReviewCount: 4 });
    const steps = budgetHealthNextSteps(risky.reasons);
    expect(steps.join(' ')).toMatch(/Rörlig Budget|minus/);
    expect(steps.join(' ')).not.toMatch(/income-missing|negative-margin/);
  });

  it('uses a safe Buddy handoff message without raw transaction data or mutation claims', () => {
    expect(budgetHealthImprovementMessage).toContain('Ändra ingenting');
    expect(budgetHealthImprovementMessage).toContain('actionkort');
    expect(budgetHealthImprovementMessage).not.toMatch(/transaktion|kontoutdrag|rådata|applicera|förbättrades/i);
  });

});
