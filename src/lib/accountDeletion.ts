import type { AppState } from '../types';

export function deleteAccountAndRelatedData(state: AppState, accountId: string): AppState {
  const removedTxIds = new Set(state.transactions.filter(t => t.accountId === accountId).map(t => t.id));
  if (!state.accounts.some(a => a.id === accountId)) return state;

  const transferDecisions = Object.fromEntries(
    Object.entries(state.transferDecisions).filter(([transferId]) => {
      return ![...removedTxIds].some(txId => transferId.includes(txId));
    }),
  );

  const reviewDecisions = state.reviewDecisions
    ? Object.fromEntries(
        Object.entries(state.reviewDecisions).filter(([reviewId]) => {
          return ![...removedTxIds].some(txId => reviewId.includes(txId));
        }),
      )
    : state.reviewDecisions;

  return {
    ...state,
    accounts: state.accounts.filter(a => a.id !== accountId),
    transactions: state.transactions.filter(t => t.accountId !== accountId),
    transferDecisions,
    reviewDecisions,
  };
}
