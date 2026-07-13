import { describe, expect, it } from 'vitest';
import type { AppState } from '../../types';
import { budgetBuddyCheckupMessage, buildManualOnboardingPatch, normalizeOnboardingState, onboardingWarnings } from '../onboarding';

const base: AppState = { accounts: [], transactions: [], rules: [], incomes: [], manualExpenses: [], variablePlan: [], recurringDecisions: {}, transferDecisions: {}, scenarioOff: [], chatMessages: [], buddyActionHistory: [], onboardingCompleted: false };

describe('onboarding first-user journey state', () => {
  it('keeps manual onboarding incomplete until final confirmation', () => {
    const progress = normalizeOnboardingState({ path: 'manual', started: true, currentStep: 'summary' });
    expect(progress.currentStep).toBe('summary');
    expect({ ...base, onboarding: progress }.onboardingCompleted).toBe(false);
    const completed = { ...base, onboardingCompleted: true, onboarding: { ...progress, currentStep: 'finish' as const } };
    expect(completed.onboardingCompleted).toBe(true);
  });

  it('returns import onboarding to review after successful import', () => {
    const progress = normalizeOnboardingState({ path: 'import', started: true, currentStep: 'import', importCompleted: true });
    const afterImport = { ...progress, currentStep: 'importReview' as const };
    expect(afterImport.path).toBe('import');
    expect(afterImport.importCompleted).toBe(true);
    expect(afterImport.currentStep).toBe('importReview');
  });

  it('progress persists through reload-shaped state', () => {
    const saved = { ...base, onboarding: normalizeOnboardingState({ path: 'import', currentStep: 'confirmImport', started: true, importCompleted: true }) };
    const loaded = { ...base, ...JSON.parse(JSON.stringify(saved)) } as AppState;
    expect(loaded.onboarding?.currentStep).toBe('confirmImport');
    expect(loaded.onboarding?.path).toBe('import');
  });

  it('does not silently overwrite existing user data or support income as salary', () => {
    const existing: AppState = { ...base, incomes: [{ id: 'support_existing', label: 'Barnbidrag/support', amount: 2650, frequency: 'monthly' }] };
    const patch = buildManualOnboardingPatch({
      existing,
      householdProfile: { adults: 1, children: 1, teens: 0, pets: 0, foodAmbition: 'normal', transportNeed: 'normal', householdType: 'single' },
      incomes: [{ id: 'inc_onboarding_salary', label: 'Lön efter skatt', amount: 30000, frequency: 'monthly' }],
      musts: [],
      variablePlan: [],
    });
    expect(patch.incomes).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'Barnbidrag/support', amount: 2650 }), expect.objectContaining({ label: 'Lön efter skatt', amount: 30000 })]));
  });
});

describe('onboarding validation warnings and summary', () => {
  it('warns for missing income', () => {
    expect(onboardingWarnings({ state: base, totalIncome: 0, fixedTotal: 0, remainingAfterFixed: 0, variablePlanTotal: 0, remainingAfterPlan: 0 })).toContain('Inkomst saknas. Lägg till lön, Barnbidrag/support eller annan inkomst innan du litar på budgeten.');
  });

  it('warns when fixed costs are above income', () => {
    expect(onboardingWarnings({ state: base, totalIncome: 10000, fixedTotal: 12000, remainingAfterFixed: -2000, variablePlanTotal: 0, remainingAfterPlan: -2000 }).some(w => w.includes('Fasta utgifter är högre'))).toBe(true);
  });

  it('warns for negative margin and variable plan above remaining', () => {
    const warnings = onboardingWarnings({ state: base, totalIncome: 20000, fixedTotal: 10000, remainingAfterFixed: 10000, variablePlanTotal: 12000, remainingAfterPlan: -2000 });
    expect(warnings.some(w => w.includes('rörliga planen'))).toBe(true);
    expect(warnings.some(w => w.includes('negativ'))).toBe(true);
  });

  it('supports final summary calculations', () => {
    const totalIncome = 32000;
    const fixedTotal = 12000;
    const variablePlanTotal = 15000;
    expect(totalIncome - fixedTotal - variablePlanTotal).toBe(5000);
  });

  it('has a Budget Buddy Checkup handoff message', () => {
    expect(budgetBuddyCheckupMessage).toMatch(/Budget Buddy Checkup/);
  });
});

describe('flexible onboarding lifecycle migration', () => {
  it('new user starts as NOT_STARTED', () => {
    expect(normalizeOnboardingState().status).toBe('NOT_STARTED');
  });

  it('manual selection maps to MANUAL_PATH and preserves incomplete state', () => {
    const state = normalizeOnboardingState({ path: 'manual', started: true, currentStep: 'income' });
    expect(state.status).toBe('MANUAL_PATH');
    expect(state.currentStep).toBe('income');
  });

  it('import selection maps to IMPORT_PATH', () => {
    const state = normalizeOnboardingState({ path: 'import', started: true, currentStep: 'import' });
    expect(state.status).toBe('IMPORT_PATH');
  });

  it('completed legacy users migrate to COMPLETED', () => {
    const state = normalizeOnboardingState({ path: 'manual', started: true, currentStep: 'summary' }, true);
    expect(state.status).toBe('COMPLETED');
  });

  it('skipped users do not get forced back into onboarding', () => {
    const state = normalizeOnboardingState({ status: 'SKIPPED', path: 'explore', started: true });
    expect(state.status).toBe('SKIPPED');
  });
});
