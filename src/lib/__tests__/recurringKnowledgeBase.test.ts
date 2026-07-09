import { describe, expect, it } from 'vitest';
import { categorize } from '../rulesEngine';
import { detectRecurring, getActionableRecurringCandidates } from '../recurrenceEngine';
import type { Account, Transaction } from '../../types';

const accounts: Account[] = [{ id: 'a1', name: 'Lönekonto', isOwn: true }, { id: 'a2', name: 'Sparkonto', isOwn: true }];

function tx(id: string, date: string, description: string, amount: number, accountId = 'a1'): Transaction {
  return { id, accountId, date, description, amount };
}

describe('recurring knowledge base classification policy', () => {
  it('surfaces important single-month income and fixed candidates without surfacing everyday variable purchases', () => {
    const detection = detectRecurring([
      tx('salary', '2026-01-25', 'Lön Arbetsgivare AB', 35000),
      tx('rent', '2026-01-01', 'Bostadsrättsavgift BRF', -7500),
      tx('power', '2026-01-05', 'Vattenfall elnät', -850),
      tx('internet', '2026-01-06', 'Bahnhof bredband', -399),
      tx('food', '2026-01-08', 'Willys', -820),
      tx('coffee', '2026-01-09', 'Pressbyrån kaffe', -45),
    ], accounts, [], {});
    const actionable = getActionableRecurringCandidates(detection.recurring);

    expect(actionable.map(r => r.label)).toEqual(expect.arrayContaining(['Lön Arbetsgivare AB', 'Bostadsrättsavgift BRF', 'Vattenfall elnät', 'Bahnhof bredband']));
    expect(actionable.find(r => r.label === 'Willys')).toBeUndefined();
    expect(actionable.find(r => r.label === 'Pressbyrån kaffe')).toBeUndefined();
  });

  it('detects recurring income and fixed costs over months', () => {
    const detection = detectRecurring([
      tx('salary1', '2026-01-25', 'Lön Arbetsgivare AB', 35000),
      tx('salary2', '2026-02-25', 'Lön Arbetsgivare AB', 35000),
      tx('child1', '2026-01-20', 'Barnbidrag', 2650),
      tx('child2', '2026-02-20', 'Barnbidrag', 2650),
      tx('gym1', '2026-01-15', 'Gym medlemskap', -299),
      tx('gym2', '2026-02-15', 'Gym medlemskap', -299),
    ], accounts, [], {});

    expect(detection.recurring.find(r => r.label === 'Lön Arbetsgivare AB')?.costTypeDefault).toBe('income');
    expect(detection.recurring.find(r => r.label === 'Barnbidrag')?.costTypeDefault).toBe('income');
    expect(detection.recurring.find(r => r.label === 'Gym medlemskap')?.costTypeDefault).toBe('fixed');
  });

  it('neutralizes transfers/savings and prevents refunds from becoming income', () => {
    const detection = detectRecurring([
      tx('avanza', '2026-01-10', 'Avanza ISK månadssparande', -2000),
      tx('topup', '2026-01-11', 'Lunar top-up', -500),
      tx('refund1', '2026-01-12', 'Refund butik retur', 499),
      tx('refund2', '2026-01-12', 'Kreditering butik retur', 299),
      tx('transferOut', '2026-01-15', 'Överföring sparkonto', -1000, 'a1'),
      tx('transferIn', '2026-01-15', 'Insättning från lönekonto', 1000, 'a2'),
    ], accounts, [], {});

    expect(detection.recurring.filter(r => r.costTypeDefault === 'income')).toHaveLength(0);
    expect(detection.recurring.find(r => r.label.includes('Avanza'))).toBeUndefined();
    expect(detection.recurring.find(r => r.label.includes('Lunar'))).toBeUndefined();
    expect(detection.transfers).toHaveLength(1);
  });

  it('uses general internet keywords instead of one customer-specific merchant', () => {
    for (const description of ['Bredband2', 'Telia Fiber', 'Bahnhof', 'Internetleverantör AB']) {
      const result = categorize(description, []);
      expect(result.costType).toBe('fixed');
      expect(result.category).toBe('Internet');
      expect(result.source).toBe('knowledge-base');
    }
  });
});
