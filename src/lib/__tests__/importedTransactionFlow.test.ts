import { describe, expect, it } from 'vitest';
import { calculateBudget } from '../budgetCalculator';
import { makeBuddyReply } from '../budgetBuddy';
import { detectRecurring, getActionableRecurringCandidates, isActionableRecurringCandidate } from '../recurrenceEngine';
import type { Account, RecurringExpense, Transaction } from '../../types';

const accounts: Account[] = [{ id: 'a1', name: 'Lönekonto', isOwn: true }];

const singleMonthTxs: Transaction[] = [
  { id: 'salary', accountId: 'a1', date: '2026-06-25', description: 'Lön Exempelbolaget', amount: 35000 },
  { id: 'rent', accountId: 'a1', date: '2026-06-01', description: 'Hyra', amount: -14000 },
  { id: 'electricity', accountId: 'a1', date: '2026-06-03', description: 'Elbolaget', amount: -1200 },
  { id: 'telia', accountId: 'a1', date: '2026-06-05', description: 'Telia', amount: -950 },
  { id: 'ica', accountId: 'a1', date: '2026-06-11', description: 'ICA', amount: -800 },
  { id: 'coffee', accountId: 'a1', date: '2026-06-12', description: 'Espresso House', amount: -65 },
];

function candidateByLabel(candidates: RecurringExpense[], text: string) {
  return candidates.find(item => item.label.toLowerCase() === text.toLowerCase());
}

describe('imported transaction actionable candidate flow', () => {
  it('surfaces single-month income and fixed candidates without everyday noise', () => {
    const detection = detectRecurring(singleMonthTxs, accounts, [], {});
    const actionable = getActionableRecurringCandidates(detection.recurring);

    expect(candidateByLabel(actionable, 'Lön Exempelbolaget')?.costTypeDefault).toBe('income');
    expect(candidateByLabel(actionable, 'Hyra')?.costTypeDefault).toBe('fixed');
    expect(candidateByLabel(actionable, 'Elbolaget')?.costTypeDefault).toBe('fixed');
    expect(candidateByLabel(actionable, 'Telia')?.costTypeDefault).toBe('fixed');
    expect(candidateByLabel(actionable, 'ICA')).toBeUndefined();
    expect(candidateByLabel(actionable, 'Espresso House')).toBeUndefined();
  });

  it('uses the recurring view filter rules for actionable candidates', () => {
    const base: RecurringExpense = {
      id: 'base', normName: 'base', label: 'Base', category: 'Okategoriserad', costTypeDefault: 'variable', frequency: 'irregular', occurrences: 1,
      monthlyAmount: 75, meanAmount: 75, minAmount: 75, maxAmount: 75, amountVaries: false, confidence: 20, lastDate: '2026-06-01', txIds: ['t1'], reason: '',
    };

    expect(isActionableRecurringCandidate({ ...base, id: 'income', costTypeDefault: 'income', monthlyAmount: 35000 })).toBe(true);
    expect(isActionableRecurringCandidate({ ...base, id: 'fixed', costTypeDefault: 'fixed', monthlyAmount: 950 })).toBe(true);
    expect(isActionableRecurringCandidate({ ...base, id: 'confident', confidence: 50 })).toBe(true);
    expect(isActionableRecurringCandidate({ ...base, id: 'coffee', label: 'Espresso House', monthlyAmount: 65, confidence: 20 })).toBe(false);
  });

  it('does not count imported candidates before confirmation but counts them afterwards', () => {
    const detection = detectRecurring(singleMonthTxs, accounts, [], {});
    const salary = candidateByLabel(detection.recurring, 'Lön Exempelbolaget');
    const rent = candidateByLabel(detection.recurring, 'Hyra');
    expect(salary).toBeTruthy();
    expect(rent).toBeTruthy();

    const before = calculateBudget({ detection, recurringDecisions: {}, incomes: [], manualExpenses: [], variablePlan: [] });
    expect(before.totalIncome).toBe(0);
    expect(before.fixedTotal).toBe(0);

    const after = calculateBudget({
      detection,
      recurringDecisions: {
        [salary!.id]: { status: 'confirmed' },
        [rent!.id]: { status: 'confirmed' },
      },
      incomes: [],
      manualExpenses: [],
      variablePlan: [],
    });
    expect(after.totalIncome).toBe(35000);
    expect(after.fixedTotal).toBe(14000);
  });

  it('provides import-review badge data and Budget Buddy context counts after import', () => {
    const detection = detectRecurring(singleMonthTxs, accounts, [], {});
    const actionable = getActionableRecurringCandidates(detection.recurring);

    expect(singleMonthTxs.length).toBeGreaterThan(0);
    expect(actionable.length).toBeGreaterThan(0);
    expect(actionable.filter(r => r.costTypeDefault === 'income')).toHaveLength(1);
    expect(actionable.filter(r => r.costTypeDefault !== 'income')).toHaveLength(3);

    const summary = calculateBudget({ detection, recurringDecisions: {}, incomes: [], manualExpenses: [], variablePlan: [] });
    const reply = makeBuddyReply('Varför syns inte mina importerade inkomster i översikten?', {
      summary,
      detection,
      rules: [],
      transactionCount: singleMonthTxs.length,
      recurringCandidateCount: actionable.length,
      actionableIncomeCandidateCount: 1,
      actionableExpenseCandidateCount: 3,
      confirmedRecurringCount: 0,
      unconfirmedRecurringCount: actionable.length,
    });

    expect(reply.content).toContain('inte bekräftade än');
    expect(reply.content).toContain('Import & granskning');
  });
});
