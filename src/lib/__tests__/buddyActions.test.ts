import { describe, expect, it } from 'vitest';
import type { AppState, BuddyProposedAction } from '../../types';
import { applyBuddyAction, applyBuddyActionWithResult, undoLastBuddyAction } from '../buddyActions';

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

describe('applyBuddyAction variable plan semantics', () => {
  it('updates state.variablePlan when confirmed', () => {
    const action: BuddyProposedAction = { id: 'vp', type: 'update_variable_plan', title: '', description: '', payload: { items: [{ label: 'Mat', amount: 5000, category: 'Mat', include: true }] }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending' };
    expect(applyBuddyAction(base, action).variablePlan).toMatchObject([{ label: 'Mat', amount: 5000 }]);
  });

  it('does not use marginLeft as a total cap', () => {
    const action: BuddyProposedAction = { id: 'vp', type: 'update_variable_plan', title: '', description: '', payload: { marginLeft: 1000, items: [{ label: 'Mat', amount: 5000, category: 'Mat', include: true }] }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending' };
    expect(applyBuddyAction(base, action).variablePlan[0].amount).toBe(5000);
  });

  it('scales total variable plan down to availableAfterFixed when provided', () => {
    const action: BuddyProposedAction = { id: 'vp', type: 'update_variable_plan', title: '', description: '', payload: { availableAfterFixed: 5000, items: [{ label: 'Mat', amount: 8000, category: 'Mat', include: true }, { label: 'Nöje', amount: 2000, category: 'Nöje', include: true }] }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending' };
    const next = applyBuddyAction(base, action);
    expect(next.variablePlan.reduce((sum, item) => sum + item.amount, 0)).toBeLessThanOrEqual(5000);
  });
});


describe('buddy action v2 foundations', () => {
  it('applies and undoes update_variable_plan', () => {
    const original = [{ id: 'old', label: 'Mat och hushåll', amount: 3000, category: 'Mat', include: true }];
    const action: BuddyProposedAction = { id: 'vp2', type: 'update_variable_plan', title: 'Använd ny rörlig plan', description: '', payload: { availableAfterFixed: 6000, items: [{ label: 'Mat och hushåll', amount: 4000, category: 'Mat', include: true }] }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending', riskLevel: 'medium', undoable: true };
    const applied = applyBuddyActionWithResult({ ...base, variablePlan: original }, action);
    expect(applied.state.variablePlan[0].amount).toBe(4000);
    const undone = undoLastBuddyAction(applied.state);
    expect(undone.state.variablePlan).toEqual(original);
  });

  it('applies create_rule, move_recurring_item, reject_recurring_item and duplicate income actions without touching transactions', () => {
    const state = { ...base, transactions: [{ id: 'tx1', accountId: 'a', date: '2026-07-01', description: 'Netflix', amount: -129 }] };
    const rule: BuddyProposedAction = { id: 'r', type: 'create_rule', title: 'Skapa regel', description: '', payload: { matchText: 'Matboden', category: 'Mat', costType: 'variable' }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending', riskLevel: 'low' };
    const moved: BuddyProposedAction = { id: 'm', type: 'move_recurring_item', title: 'Flytta post', description: '', payload: { recurringId: 'rec1', label: 'Netflix', to: 'variable' }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending', riskLevel: 'low' };
    const rejected: BuddyProposedAction = { id: 'x', type: 'reject_recurring_item', title: 'Räkna bort', description: '', payload: { recurringId: 'rec2', label: 'Intern överföring' }, confirmLabel: 'Ja', cancelLabel: 'Nej', status: 'pending', riskLevel: 'medium' };
    const dupe: BuddyProposedAction = { id: 'd', type: 'fix_duplicate_income', title: 'Möjlig dubbelräkning av lön', description: '', payload: { incomeId: 'rec_salary', label: 'Importerad lön' }, confirmLabel: 'Räkna bort importerad lön', cancelLabel: 'Behåll båda', status: 'pending', riskLevel: 'medium' };
    const s1 = applyBuddyActionWithResult(state, rule).state;
    const s2 = applyBuddyActionWithResult(s1, moved).state;
    const s3 = applyBuddyActionWithResult(s2, rejected).state;
    const s4 = applyBuddyActionWithResult(s3, dupe).state;
    expect(s4.rules[0].matchText).toBe('Matboden');
    expect(s4.recurringDecisions.rec1.costType).toBe('variable');
    expect(s4.recurringDecisions.rec2.status).toBe('rejected');
    expect(s4.recurringDecisions.rec_salary.status).toBe('rejected');
    expect(s4.transactions).toEqual(state.transactions);
  });

  it('represents scenario and checkup action cards', () => {
    const scenario: BuddyProposedAction = { id: 's', type: 'create_scenario', title: 'Scenario: utan bil', description: '', payload: { scenarioOffIds: ['car'], currentMargin: 100, scenarioMargin: 2100 }, confirmLabel: 'Visa scenario', cancelLabel: 'Avbryt', status: 'pending', riskLevel: 'low' };
    const checkup: BuddyProposedAction = { id: 'c', type: 'run_budget_checkup', title: 'Jag hittade 4 saker att dubbelkolla', description: '', payload: { issues: [{ label: 'Möjlig dubbelräkning av lön', severity: 'warning', nextAction: 'Välj vilken lön som ska räknas' }] }, confirmLabel: 'Gå igenom med mig', cancelLabel: 'Inte nu', status: 'pending', riskLevel: 'low' };
    expect(scenario.payload.scenarioOffIds).toContain('car');
    expect(checkup.payload.issues[0].label).toMatch(/dubbelräkning/);
  });
});
