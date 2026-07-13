import { describe, expect, it } from 'vitest';
import type { AppState, BudgetSummary, DetectionResult } from '../../types';
import { buildPremiumValueSummary } from '../premiumValue';

const baseState: AppState = { accounts: [], transactions: [], rules: [], incomes: [], manualExpenses: [], variablePlan: [], recurringDecisions: {}, transferDecisions: {}, scenarioOff: [], chatMessages: [], buddyActionHistory: [], onboardingCompleted: true, activeWorkspaceId: 'ws_a', premiumGoals: [], premiumSnapshots: [], premiumMonitoring: { enabled: false }, premiumActivation: { onboardingShown: false }, consentRecords: [], aiContextLog: [], privacyPreferences: { aiEnabled: false, optionalAnalyticsEnabled: false, marketingEnabled: false } };
const detection: DetectionResult = { transfers: [], recurring: [], reviewItems: [] };
function summary(patch: Partial<BudgetSummary>): BudgetSummary { return { totalIncome: 30000, fixedTotal: 19000, variablePlanTotal: 10500, totalMonthlyPlan: 29500, remainingAfterFixed: 11000, remainingAfterPlan: 500, fixedItems: [], variableItems: [{ id: 'food', label: 'Mat', category: 'Vardag', amount: 7000, source: 'variablePlan' }], activeRecurring: [], incomeItems: [], warnings: [], ...patch }; }

describe('premium value summary', () => {
  it('creates deterministic opportunities for thin margin and high fixed share', () => {
    const first = buildPremiumValueSummary({ state: baseState, summary: summary({ fixedTotal: 21000, remainingAfterPlan: 500 }), detection, visibleReviewCount: 0 });
    const second = buildPremiumValueSummary({ state: baseState, summary: summary({ fixedTotal: 21000, remainingAfterPlan: 500 }), detection, visibleReviewCount: 0 });
    expect(first.opportunityCount).toBeGreaterThan(0);
    expect(first.opportunities).toHaveLength(Math.min(3, first.opportunityCount));
    expect(first.opportunities.map(o => o.id)).toEqual(second.opportunities.map(o => o.id));
    expect(first.estimatedMonthlyMarginPotential).toBeGreaterThanOrEqual(0);
    expect(first.opportunities[0].estimationNote).toMatch(/Uppskattad|område att granska|garanterad/);
  });

  it('handles zero income, negative margin and reliability-only issues safely', () => {
    const result = buildPremiumValueSummary({ state: baseState, summary: summary({ totalIncome: 0, fixedTotal: 4000, variablePlanTotal: 2000, remainingAfterFixed: -4000, remainingAfterPlan: -6000 }), detection: { ...detection, reviewItems: [{ id: 'r', type: 'duplicate', description: 'Oklar', amount: -100, note: 'test' }] }, visibleReviewCount: 1, duplicateIncomeCount: 1 });
    expect(Number.isFinite(result.estimatedMonthlyMarginPotential)).toBe(true);
    expect(result.opportunities.find(o => o.id === 'duplicate-income')?.estimatedMarginImpact).toBe(0);
    expect(result.opportunities.find(o => o.id === 'unresolved-review')?.estimatedMarginImpact).toBe(0);
    expect(result.alternatives.map(a => a.mode)).toEqual(['safe', 'balanced', 'ambitious']);
  });

  it('keeps workspace-specific goals and development snapshots separated by caller state', () => {
    const state: AppState = { ...baseState, activeWorkspaceId: 'ws_a', premiumGoals: [{ id: 'g1', workspaceId: 'ws_a', title: 'Bygg 10 % marginal', reason: 'test', targetType: 'margin_ratio', targetValue: 0.1, currentValue: 0.02, status: 'active', createdAt: '2026-01-01' }], premiumSnapshots: [{ id: 's1', workspaceId: 'ws_a', createdAt: '2026-01-01', totalIncome: 30000, fixedTotal: 20000, variablePlanTotal: 9000, remainingAfterPlan: 1000, budgetHealthScore: 60 }] };
    const result = buildPremiumValueSummary({ state, summary: summary({ remainingAfterPlan: 2500, fixedTotal: 19000 }), detection });
    expect(result.currentGoalSummary).toContain('aktivt mål');
    expect(result.developmentSummary).toContain('Marginal');
    expect(result.strongestPositiveChange).toBeTruthy();
  });
});
