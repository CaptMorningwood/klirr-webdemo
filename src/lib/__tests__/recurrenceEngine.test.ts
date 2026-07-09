import { describe, expect, it } from 'vitest';
import { detectRecurring } from '../recurrenceEngine';
import type { Account, Transaction } from '../../types';

const accounts: Account[] = [
  { id: 'a1', name: 'Lönekonto', isOwn: true },
  { id: 'a2', name: 'Sparkonto', isOwn: true },
];

describe('recurrenceEngine stability filters', () => {
  it('does not flood review items with everyday small purchases', () => {
    const txs: Transaction[] = Array.from({ length: 6 }, (_, index) => ({ id: `t${index}`, accountId: 'a1', date: `2026-0${index + 1}-05`, description: 'ICA Nära', amount: -120 - index }));
    const detection = detectRecurring(txs, accounts, [], {});
    expect(detection.reviewItems).toHaveLength(0);
  });

  it('does not classify own-account transfers as income', () => {
    const txs: Transaction[] = [
      { id: 'out', accountId: 'a1', date: '2026-01-10', description: 'Överföring sparkonto', amount: -5000 },
      { id: 'in', accountId: 'a2', date: '2026-01-10', description: 'Överföring från lönekonto', amount: 5000 },
    ];
    const detection = detectRecurring(txs, accounts, [], {});
    expect(detection.recurring.filter(item => item.costTypeDefault === 'income')).toHaveLength(0);
  });
});
