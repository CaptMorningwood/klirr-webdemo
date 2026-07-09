import { describe, expect, it } from 'vitest';
import type { AppState, BuddyProposedAction } from '../../types';
import { applyBuddyAction } from '../buddyActions';

const base: AppState = { accounts: [], transactions: [], rules: [], incomes: [], manualExpenses: [], variablePlan: [], recurringDecisions: {}, transferDecisions: {}, scenarioOff: [], chatMessages: [], onboardingCompleted: true };

describe('applyBuddyAction', () => {
  it('adds income when none exists', () => {
    const action: BuddyProposedAction = { id: 'a', type: 'update_income', title: '', description: '', payload: { label: 'Lön efter skatt', amount: 34000, frequency: 'monthly' }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending' };
    expect(applyBuddyAction(base, action).incomes[0].amount).toBe(34000);
  });
  it('updates income by id', () => {
    const state = { ...base, incomes: [{ id: 'i1', label: 'Lön', amount: 1, frequency: 'monthly' as const }] };
    const action: BuddyProposedAction = { id: 'a', type: 'update_income', title: '', description: '', payload: { incomeId: 'i1', label: 'Lön', amount: 35000, frequency: 'monthly' }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending' };
    expect(applyBuddyAction(state, action).incomes[0].amount).toBe(35000);
  });
  it('updates variable plan and clamps negative amounts', () => {
    const action: BuddyProposedAction = { id: 'a', type: 'update_variable_plan', title: '', description: '', payload: { items: [{ label: 'Mat', amount: -10, category: 'Vardag', include: true }] }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending' };
    expect(applyBuddyAction(base, action).variablePlan[0].amount).toBe(0);
  });
});
