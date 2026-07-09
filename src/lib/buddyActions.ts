import type { AppState, BuddyProposedAction, VariablePlanItem } from '../types';
import { uid } from './format';

function validAmount(amount: number) {
  return Number.isFinite(amount) && amount > 0 && amount < 500000;
}

export function applyBuddyAction(state: AppState, action: BuddyProposedAction): AppState {
  if (action.type === 'update_income') {
    const amount = Math.round(Number(action.payload.amount));
    if (!validAmount(amount)) return state;
    const payload = { label: action.payload.label || 'Lön efter skatt', amount, frequency: 'monthly' as const };
    const incomeId = action.payload.incomeId;
    if (incomeId && state.incomes.some(income => income.id === incomeId)) {
      return { ...state, incomes: state.incomes.map(income => income.id === incomeId ? { ...income, ...payload } : income) };
    }
    if (state.incomes.length === 1 && state.incomes[0].frequency === 'monthly') {
      return { ...state, incomes: [{ ...state.incomes[0], ...payload }] };
    }
    const similar = state.incomes.find(income => income.label.toLowerCase() === payload.label.toLowerCase());
    if (similar) {
      return { ...state, incomes: state.incomes.map(income => income.id === similar.id ? { ...income, ...payload } : income) };
    }
    return { ...state, incomes: [...state.incomes, { id: uid('inc'), ...payload }] };
  }

  if (action.type === 'update_variable_plan') {
    const incoming = action.payload.items
      .filter(item => Number.isFinite(Number(item.amount)))
      .map(item => ({ ...item, amount: Math.max(0, Math.round(Number(item.amount))) }));
    const allowedTotal = Number(action.payload.marginLeft ?? NaN);
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
    return { ...state, variablePlan: items };
  }

  return state;
}

export function findPendingBuddyAction(state: AppState): BuddyProposedAction | null {
  for (let i = state.chatMessages.length - 1; i >= 0; i -= 1) {
    const action = state.chatMessages[i].proposedAction;
    if (action?.status === 'pending') return action;
  }
  return null;
}
