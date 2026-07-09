import { describe, expect, it } from 'vitest';
import { deleteAccountAndRelatedData } from '../accountDeletion';
import type { AppState } from '../../types';

const baseState: AppState = {
  accounts: [
    { id: 'acc_keep', name: 'Manual bank', isOwn: true },
    { id: 'acc_delete', name: 'Imported bank', isOwn: true },
  ],
  transactions: [
    { id: 'tx_keep', accountId: 'acc_keep', date: '2026-06-01', description: 'Keep', amount: 100 },
    { id: 'tx_delete', accountId: 'acc_delete', date: '2026-06-02', description: 'Delete', amount: 200 },
  ],
  rules: [],
  incomes: [{ id: 'manual_income', label: 'Manual salary', amount: 30000, frequency: 'monthly' }],
  manualExpenses: [{ id: 'manual_expense', label: 'Rent', amount: 10000, category: 'Boende', costType: 'fixed', active: true }],
  variablePlan: [{ id: 'vp_food', label: 'Food', amount: 5000, category: 'Vardag', include: true }],
  recurringDecisions: { rec_salary: { status: 'confirmed', costType: 'income' } },
  transferDecisions: { tr_tx_delete_tx_keep: { status: 'confirmed' }, tr_other: { status: 'confirmed' } },
  reviewDecisions: { outlier_tx_delete: { status: 'rejected' }, other: { status: 'confirmed' } },
  scenarioOff: [],
  chatMessages: [{ id: 'chat_1', role: 'assistant', content: 'Hej', createdAt: '2026-07-09' }],
  buddyActionHistory: [{ id: 'hist_1', type: 'rendered', createdAt: '2026-07-09' }],
  onboardingCompleted: true,
};

describe('deleteAccountAndRelatedData', () => {
  it('deletes the account, its transactions, and related decisions without deleting manual data', () => {
    const next = deleteAccountAndRelatedData(baseState, 'acc_delete');

    expect(next.accounts.map(a => a.id)).toEqual(['acc_keep']);
    expect(next.transactions.map(t => t.id)).toEqual(['tx_keep']);
    expect(next.transferDecisions).toEqual({ tr_other: { status: 'confirmed' } });
    expect(next.reviewDecisions).toEqual({ other: { status: 'confirmed' } });
    expect(next.incomes).toEqual(baseState.incomes);
    expect(next.manualExpenses).toEqual(baseState.manualExpenses);
    expect(next.variablePlan).toEqual(baseState.variablePlan);
    expect(next.chatMessages).toEqual(baseState.chatMessages);
    expect(next.buddyActionHistory).toEqual(baseState.buddyActionHistory);
  });
});
