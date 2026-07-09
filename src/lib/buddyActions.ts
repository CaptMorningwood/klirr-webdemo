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
    const amount = Math.round(Number(action.payload.amount));
    if (!validAmount(amount)) return { state, status: 'failed', message: 'Beloppet måste vara större än 0 och mindre än 500 000 kr.' };
    const payload = { label: action.payload.label || 'Lön efter skatt', amount, frequency: 'monthly' as const, notes: action.payload.notes };
    const incomeId = action.payload.incomeId;
    const replaceMode = action.payload.replaceMode || (incomeId ? 'update_existing' : state.incomes.length === 0 ? 'add_new' : 'update_existing');
    if (replaceMode === 'update_existing') {
      if (incomeId && state.incomes.some(income => income.id === incomeId)) {
        const next = { ...state, incomes: state.incomes.map(income => income.id === incomeId ? { ...income, ...payload } : income) };
        return { state: next, status: 'applied', message: `Klart — jag uppdaterade “${payload.label}” till cirka ${amount.toLocaleString('sv-SE')} kr/mån ✅` };
      }
      if (!incomeId && state.incomes.length === 1) {
        const label = payload.label || state.incomes[0].label;
        const next = { ...state, incomes: [{ ...state.incomes[0], ...payload, label }] };
        return { state: next, status: 'applied', message: `Klart — jag uppdaterade “${label}” till cirka ${amount.toLocaleString('sv-SE')} kr/mån ✅` };
      }
      return { state, status: state.incomes.length > 1 ? 'needs_choice' : 'failed', message: 'Jag behöver veta vilken inkomst som ska bytas ut, så jag skapade ingen dubblett.' };
    }
    if (replaceMode === 'add_new') {
      const next = { ...state, incomes: [...state.incomes, { id: uid('inc'), ...payload }] };
      return { state: next, status: 'applied', message: `Klart — jag lade till “${payload.label}” på cirka ${amount.toLocaleString('sv-SE')} kr/mån ✅` };
    }
    return { state, status: 'failed', message: 'Action saknade replaceMode och kunde inte appliceras säkert.' };
  }

  if (action.type === 'update_variable_plan') {
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
    return { state: { ...state, variablePlan: items }, status: 'applied', message: 'Klart — jag uppdaterade den rörliga planen ✅' };
  }

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
