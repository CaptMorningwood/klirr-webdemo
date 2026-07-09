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


  it('does not update a single support-like income for salary changes', () => {
    const action = salaryPlan([{ id: 'child', label: 'Barnbidrag', amount: 2650, frequency: 'monthly' }]).proposedAction;
    expect(action?.type).toBe('update_income');
    if (action?.type === 'update_income') {
      expect(action.payload.replaceMode).toBe('add_new');
      expect(action.payload.incomeId).toBeUndefined();
      expect(action.payload.label).toBe('Lön efter skatt');
    }
  });

  it('considers imported confirmed salary income instead of updating manual Barnbidrag', () => {
    const plan = planBuddyAction({
      message: 'min nya lön är 60000',
      incomes: [{ id: 'child', label: 'Barnbidrag', amount: 2650, frequency: 'monthly' }],
      context: { summary: { remainingAfterFixed: 10000, incomeItems: [{ id: 'child', label: 'Barnbidrag', amount: 2650, category: 'Inkomst', source: 'manual', frequency: 'monthly' }, { id: 'rec_salary', label: 'Lön Exempelbolaget', amount: 32000, category: 'Inkomst', source: 'recurring', frequency: 'monthly' }] } },
    });
    expect(plan.proposedAction).toBeUndefined();
    expect(plan.clarificationQuestion).toMatch(/Lön Exempelbolaget|importerade/i);
    expect(plan.explanationHints?.join(' ')).toMatch(/stödinkomster används aldrig/i);
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

describe('buddyActionPlanner variable plan actions', () => {
  const context = {
    summary: { remainingAfterFixed: 12000 },
    budgetSuggestion: {
      items: [
        { id: 'food', label: 'Mat och hushåll', amount: 7500, category: 'Mat', include: true },
        { id: 'transport', label: 'Transport rörligt', amount: 900, category: 'Transport', include: true },
        { id: 'fun', label: 'Nöje', amount: 500, category: 'Nöje', include: true },
        { id: 'other', label: 'Övrigt hushåll', amount: 1000, category: 'Övrigt', include: true },
        { id: 'buffer', label: 'Buffert/sparande', amount: 1200, category: 'Buffert', include: true },
      ],
      marginLeft: 900,
    },
  };

  it('proposes update_variable_plan for new variable plan requests', () => {
    const plan = planBuddyAction({ message: 'Kan du lägga upp en ny rörlig plan?', context });
    expect(plan.proposedAction?.type).toBe('update_variable_plan');
  });

  it('proposes update_variable_plan for safer variable plan requests', () => {
    const plan = planBuddyAction({ message: 'gör en tryggare rörlig plan', context });
    expect(plan.proposedAction?.type).toBe('update_variable_plan');
  });

  it('uses recent plan discussion when user says to use it', () => {
    const plan = planBuddyAction({
      message: 'kör på den',
      context,
      recentMessages: [{ role: 'assistant', content: 'Förslag: Mat 7 500 kr, Transport 900 kr, Nöje 500 kr, Övrigt 1 000 kr, Buffert 1 200 kr.' }],
    });
    expect(plan.proposedAction?.type).toBe('update_variable_plan');
  });

  it('does not trigger on generic economy explanations', () => {
    const plan = planBuddyAction({ message: 'förklara min ekonomi', context });
    expect(plan.proposedAction).toBeUndefined();
    expect(plan.intent).toBe('none');
  });

  it('parses explicit category amounts into the proposed plan', () => {
    const plan = planBuddyAction({ message: 'Mat 7 500 kr, Transport 900 kr, Nöje 500 kr, Övrigt 1 000 kr, Buffert 1 200 kr', context });
    expect(plan.proposedAction?.type).toBe('update_variable_plan');
    if (plan.proposedAction?.type === 'update_variable_plan') {
      expect(plan.proposedAction.payload.items.map(item => item.amount)).toEqual([7500, 900, 500, 1000, 1200]);
    }
  });
});
