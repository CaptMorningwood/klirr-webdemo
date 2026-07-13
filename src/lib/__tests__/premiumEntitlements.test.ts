import { describe, expect, it } from 'vitest';
import { freeEntitlements, getEntitlements, hasEntitlement, isPremiumPlan } from '../entitlements';
import { ensureWorkspaceState, createWorkspace, switchWorkspace, addMetricSnapshot } from '../premiumWorkspace';
import type { AppState } from '../../types';

const base = (): AppState => ({ accounts: [], transactions: [], rules: [], incomes: [], manualExpenses: [], variablePlan: [], recurringDecisions: {}, transferDecisions: {}, reviewDecisions: {}, scenarioOff: [], chatMessages: [], onboardingCompleted: true, subscriptionPlan: 'free', subscriptionStatus: 'active', entitlements: getEntitlements('free', 'active') });

describe('paused Premium entitlement compatibility', () => {
  it('returns the exact free matrix', () => {
    expect(getEntitlements('free', 'active')).toEqual(freeEntitlements);
    expect(hasEntitlement(getEntitlements('free', 'active'), 'csvImport')).toBe(true);
    expect(hasEntitlement(getEntitlements('free', 'active'), 'deepAnalysis')).toBe(false);
  });
  it('keeps paused standalone Premium UI disabled even for legacy active pro state', () => {
    expect(getEntitlements('pro', 'active').premiumHub).toBe(false);
    expect(getEntitlements('pro', 'trialing').premiumHub).toBe(false);
    expect(getEntitlements('pro', 'active').budgetBuddyAdvanced).toBe(true);
    expect(getEntitlements('pro', 'active').deepAnalysis).toBe(true);
    expect(getEntitlements('pro', 'inactive')).toEqual(freeEntitlements);
    expect(getEntitlements('pro', 'past_due')).toEqual(freeEntitlements);
    expect(isPremiumPlan('pro', 'active')).toBe(true);
    expect(isPremiumPlan('pro', 'past_due')).toBe(false);
  });
});

describe('premium workspace demo architecture', () => {
  it('migrates legacy state into Min Budget and ignores stale entitlements', () => {
    const migrated = ensureWorkspaceState({ ...base(), entitlements: getEntitlements('pro', 'active') });
    expect(migrated.workspaces?.[0].name).toBe('Min Budget');
    expect(migrated.activeBudgetId).toBe('ws_default');
    expect(migrated.workspaceData?.ws_default).toBeTruthy();
  });
  it('switches workspaces without changing global plan', () => {
    let state = ensureWorkspaceState({ ...base(), incomes: [{ id: 'i1', label: 'Lön', amount: 30000, frequency: 'monthly' }] });
    state = createWorkspace(state, 'Extra');
    const extraId = state.activeBudgetId!;
    state = { ...state, incomes: [{ id: 'i2', label: 'Projekt', amount: 10000, frequency: 'monthly' }] };
    state = switchWorkspace(state, 'ws_default');
    expect(state.incomes[0].label).toBe('Lön');
    state = switchWorkspace(state, extraId);
    expect(state.incomes[0].label).toBe('Projekt');
    expect(state.subscriptionPlan).toBe('free');
  });
  it('suppresses duplicate metric snapshots within a short interval', () => {
    const once = addMetricSnapshot(ensureWorkspaceState(base()), 'Test');
    const twice = addMetricSnapshot(once, 'Test igen');
    expect(twice.budgetMetricSnapshots?.length).toBe(1);
  });
});
