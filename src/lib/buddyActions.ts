import type { AppState, BuddyActionHistoryEntry, BuddyProposedAction, VariablePlanItem } from '../types';
import { uid } from './format';

function validAmount(amount: number) {
  return Number.isFinite(amount) && amount > 0 && amount < 500000;
}

export interface BuddyActionApplyResult { state: AppState; status: 'applied' | 'failed' | 'needs_choice'; message: string; }

export function appendBuddyActionHistory(state: AppState, entry: Omit<BuddyActionHistoryEntry, 'id' | 'createdAt'>): AppState {
  const history = [...(state.buddyActionHistory || []), { id: uid('bah'), createdAt: new Date().toISOString(), ...entry }].slice(-30);
  return { ...state, buddyActionHistory: history };
}

export function applyBuddyActionWithResult(state: AppState, action: BuddyProposedAction): BuddyActionApplyResult {
  if (action.type === 'choose_income_to_update') {
    return { state, status: 'needs_choice', message: 'Jag behöver veta vilken inkomst som ska uppdateras innan jag ändrar något.' };
  }
  if (action.type === 'update_income') {
    state = appendBuddyActionHistory(state, { actionId: action.id, actionType: action.type, type: 'rendered', message: 'undo-snapshot', undoSnapshot: { incomes: state.incomes } });
    const amount = Math.round(Number(action.payload.amount));
    if (!validAmount(amount)) return { state, status: 'failed', message: 'Beloppet måste vara större än 0 och mindre än 500 000 kr.' };
    const payload = { label: action.payload.label || 'Lön efter skatt', amount, frequency: 'monthly' as const, notes: action.payload.notes };
    const incomeId = action.payload.incomeId;
    const replaceMode = action.payload.replaceMode || (incomeId ? 'update_existing' : state.incomes.length === 0 ? 'add_new' : 'update_existing');
    if (replaceMode === 'update_existing') {
      if (incomeId && state.incomes.some(income => income.id === incomeId)) {
        const next = { ...state, incomes: state.incomes.map(income => income.id === incomeId ? { ...income, ...payload } : income) };
        return { state: next, status: 'applied', message: `Klart — jag uppdaterade “${payload.label}” till cirka ${amount.toLocaleString('sv-SE')} kr/mån ✅ Vill du ångra?` };
      }
      if (!incomeId && state.incomes.length === 1) {
        const label = payload.label || state.incomes[0].label;
        const next = { ...state, incomes: [{ ...state.incomes[0], ...payload, label }] };
        return { state: next, status: 'applied', message: `Klart — jag uppdaterade “${label}” till cirka ${amount.toLocaleString('sv-SE')} kr/mån ✅ Vill du ångra?` };
      }
      return { state, status: state.incomes.length > 1 ? 'needs_choice' : 'failed', message: 'Jag behöver veta vilken inkomst som ska bytas ut, så jag skapade ingen dubblett.' };
    }
    if (replaceMode === 'add_new') {
      const next = { ...state, incomes: [...state.incomes, { id: uid('inc'), ...payload }] };
      return { state: next, status: 'applied', message: `Klart — jag lade till “${payload.label}” på cirka ${amount.toLocaleString('sv-SE')} kr/mån ✅ Vill du ångra?` };
    }
    return { state, status: 'failed', message: 'Action saknade replaceMode och kunde inte appliceras säkert.' };
  }

  if (action.type === 'update_variable_plan') {
    state = appendBuddyActionHistory(state, { actionId: action.id, actionType: action.type, type: 'rendered', message: 'undo-snapshot', undoSnapshot: { variablePlan: state.variablePlan } });
    const incoming = action.payload.items
      .filter(item => Number.isFinite(Number(item.amount)))
      .map(item => ({ ...item, amount: Math.max(0, Math.round(Number(item.amount))) }));
    const allowedTotal = Number(action.payload.availableAfterFixed ?? NaN);
    let items: VariablePlanItem[] = incoming.map((item, index) => {
      const existing = item.id ? state.variablePlan.find(current => current.id === item.id) : state.variablePlan.find(current => current.label.toLowerCase() === item.label.toLowerCase());
      return {
        id: existing?.id || item.id || uid(`vp_buddy_${index}`),
        label: item.label || existing?.label || 'Rörlig post',
        amount: item.amount,
        category: item.category || existing?.category || 'Rörligt',
        include: item.include,
      };
    });
    if (Number.isFinite(allowedTotal) && allowedTotal >= 0) {
      const total = items.filter(item => item.include).reduce((sum, item) => sum + item.amount, 0);
      if (total > allowedTotal && total > 0) {
        const scale = allowedTotal / total;
        items = items.map(item => item.include ? { ...item, amount: Math.floor((item.amount * scale) / 100) * 100 } : item);
      }
    }
    return { state: { ...state, variablePlan: items }, status: 'applied', message: 'Klart — jag uppdaterade den rörliga planen ✅ Vill du ångra?' };
  }

  if (action.type === 'create_rule') {
    state = appendBuddyActionHistory(state, { actionId: action.id, actionType: action.type, type: 'rendered', message: 'undo-snapshot', undoSnapshot: { rules: state.rules } });
    const next = { ...state, rules: [...state.rules, { id: uid('rule'), ...action.payload }] };
    return { state: next, status: 'applied', message: 'Klart — jag skapade regeln ✅ Vill du ångra?' };
  }
  if (action.type === 'move_recurring_item') {
    state = appendBuddyActionHistory(state, { actionId: action.id, actionType: action.type, type: 'rendered', message: 'undo-snapshot', undoSnapshot: { recurringDecisions: state.recurringDecisions } });
    const current = state.recurringDecisions[action.payload.recurringId];
    const next = { ...state, recurringDecisions: { ...state.recurringDecisions, [action.payload.recurringId]: { ...current, status: 'confirmed' as const, costType: action.payload.to === 'fixed' || action.payload.to === 'variable' || action.payload.to === 'income' ? action.payload.to : current?.costType, category: action.payload.category || current?.category } } };
    return { state: next, status: 'applied', message: 'Klart — jag flyttade posten ✅ Vill du ångra?' };
  }
  if (action.type === 'reject_recurring_item') {
    const recurringId = action.payload.recurringId;
    state = appendBuddyActionHistory(state, { actionId: action.id, actionType: action.type, type: 'rendered', message: 'undo-snapshot', undoSnapshot: { recurringDecisions: state.recurringDecisions } });
    const current = state.recurringDecisions[recurringId];
    const next = { ...state, recurringDecisions: { ...state.recurringDecisions, [recurringId]: { ...current, status: 'rejected' as const, costType: current?.costType || 'fixed' as const } } };
    return { state: next, status: 'applied', message: 'Klart — jag räknade bort posten i budgeten ✅ Vill du ångra?' };
  }
  if (action.type === 'fix_duplicate_income') {
    const recurringId = action.payload.incomeId;
    state = appendBuddyActionHistory(state, { actionId: action.id, actionType: action.type, type: 'rendered', message: 'undo-snapshot', undoSnapshot: { recurringDecisions: state.recurringDecisions } });
    const current = state.recurringDecisions[recurringId];
    const next = { ...state, recurringDecisions: { ...state.recurringDecisions, [recurringId]: { ...current, status: 'rejected' as const, costType: current?.costType || 'income' as const } } };
    return { state: next, status: 'applied', message: 'Klart — jag räknade bort posten i budgeten ✅ Vill du ångra?' };
  }
  if (action.type === 'create_scenario' || action.type === 'apply_scenario_off_ids') {
    state = appendBuddyActionHistory(state, { actionId: action.id, actionType: action.type, type: 'rendered', message: 'undo-snapshot', undoSnapshot: { scenarioOff: state.scenarioOff } });
    return { state: { ...state, scenarioOff: action.payload.scenarioOffIds }, status: 'applied', message: 'Klart — jag visar scenariot ✅ Vill du ångra?' };
  }
  if (action.type === 'run_budget_checkup') return { state, status: 'applied', message: 'Jag visar checklistan här ovanför — inget i budgeten ändrades ✅' };

  return { state, status: 'failed', message: 'Okänd Budget Buddy-action.' };
}

export function applyBuddyAction(state: AppState, action: BuddyProposedAction): AppState {
  return applyBuddyActionWithResult(state, action).state;
}

export function findPendingBuddyAction(state: AppState): BuddyProposedAction | null {
  for (let i = state.chatMessages.length - 1; i >= 0; i -= 1) {
    const action = state.chatMessages[i].proposedAction;
    if (action?.status === 'pending') return action;
  }
  return null;
}

export function undoLastBuddyAction(state: AppState): BuddyActionApplyResult {
  const entry = [...(state.buddyActionHistory || [])].reverse().find(item => item.undoSnapshot);
  if (!entry?.undoSnapshot) return { state, status: 'failed', message: 'Jag hittar inget att ångra just nu.' };
  const next = { ...state, ...entry.undoSnapshot };
  return { state: appendBuddyActionHistory(next, { actionId: entry.actionId, actionType: entry.actionType, type: 'undone', message: 'Ångrat via Budget Buddy.' }), status: 'applied', message: 'Ångrat — jag återställde senaste Budget Buddy-ändringen ↩️' };
}
