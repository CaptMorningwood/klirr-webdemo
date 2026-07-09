import { describe, expect, it } from 'vitest';
import type { AppState, BuddyProposedAction, Income } from '../../types';
import { planBuddyAction } from '../buddyActionPlanner';
import { applyBuddyActionWithResult } from '../buddyActions';

const baseState: AppState = { accounts: [], transactions: [], rules: [], incomes: [], manualExpenses: [], variablePlan: [], recurringDecisions: {}, transferDecisions: {}, scenarioOff: [], chatMessages: [], buddyActionHistory: [], onboardingCompleted: true };

function salaryPlan(incomes: Income[] = []) {
  return planBuddyAction({ message: 'Jag ska få 50000 i lön, vad blir det efter skatt?', incomes, context: { incomes, summary: { remainingAfterFixed: 10000 } } });
}

describe('buddyActionPlanner salary actions', () => {
  it('is deterministic for salary actions', () => {
    const plans = Array.from({ length: 10 }, () => salaryPlan([]));
    expect(plans.every(plan => plan.proposedAction?.type === 'update_income')).toBe(true);
    expect(new Set(plans.map(plan => plan.proposedAction?.type === 'update_income' ? plan.proposedAction.payload.amount : 0)).size).toBe(1);
  });

  it('adds when zero incomes exist', () => {
    const action = salaryPlan([]).proposedAction;
    expect(action?.type).toBe('update_income');
    if (action?.type === 'update_income') expect(action.payload.replaceMode).toBe('add_new');
  });

  it('updates the single existing income', () => {
    const action = salaryPlan([{ id: 'inc_1', label: 'Min lön', amount: 32000, frequency: 'monthly' }]).proposedAction;
    expect(action?.type).toBe('update_income');
    if (action?.type === 'update_income') {
      expect(action.payload.replaceMode).toBe('update_existing');
      expect(action.payload.incomeId).toBe('inc_1');
    }
  });

  it('targets one clear salary among multiple incomes', () => {
    const action = salaryPlan([{ id: 'salary', label: 'Alex lön', amount: 34000, frequency: 'monthly' }, { id: 'child', label: 'Barnbidrag', amount: 2650, frequency: 'monthly' }]).proposedAction;
    expect(action?.type).toBe('update_income');
    if (action?.type === 'update_income') expect(action.payload.incomeId).toBe('salary');
  });

  it('requires choice for ambiguous multiple incomes', () => {
    const action = salaryPlan([{ id: 'a', label: 'Alex', amount: 30000, frequency: 'monthly' }, { id: 'r', label: 'Rebeca', amount: 31000, frequency: 'monthly' }, { id: 'b', label: 'Barnbidrag', amount: 2650, frequency: 'monthly' }]).proposedAction;
    expect(action?.type).toBe('choose_income_to_update');
  });
});

describe('applyBuddyActionWithResult', () => {
  it('updates existing income without creating duplicates', () => {
    const action: BuddyProposedAction = { id: 'a', type: 'update_income', title: 'Uppdatera', description: 'test', payload: { incomeId: 'inc_1', replaceMode: 'update_existing', label: 'Min lön', amount: 34000, frequency: 'monthly' }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending' };
    const result = applyBuddyActionWithResult({ ...baseState, incomes: [{ id: 'inc_1', label: 'Min lön', amount: 32000, frequency: 'monthly' }] }, action);
    expect(result.status).toBe('applied');
    expect(result.state.incomes).toHaveLength(1);
    expect(result.state.incomes[0].amount).toBe(34000);
  });

  it('does not apply an untargeted update when multiple incomes exist', () => {
    const action: BuddyProposedAction = { id: 'a', type: 'update_income', title: 'Uppdatera', description: 'test', payload: { replaceMode: 'update_existing', label: 'Lön', amount: 34000, frequency: 'monthly' }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending' };
    const state = { ...baseState, incomes: [{ id: 'a', label: 'Alex', amount: 1, frequency: 'monthly' as const }, { id: 'b', label: 'Rebeca', amount: 2, frequency: 'monthly' as const }] };
    const result = applyBuddyActionWithResult(state, action);
    expect(result.status).toBe('needs_choice');
    expect(result.state.incomes).toEqual(state.incomes);
  });
});
