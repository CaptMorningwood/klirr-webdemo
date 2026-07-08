import type { Account, Transaction, TransferDecision, TransferMatch } from '../types';
import { daysBetween } from './format';
import { isLikelyTransferText } from './rulesEngine';

export function matchTransfers(transactions: Transaction[], accounts: Account[], decisions: Record<string, TransferDecision>): TransferMatch[] {
  const own = new Set(accounts.filter(a => a.isOwn).map(a => a.id));
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const used = new Set<string>();
  const matches: TransferMatch[] = [];

  for (const debit of sorted) {
    if (used.has(debit.id) || debit.amount >= 0 || !own.has(debit.accountId)) continue;
    for (const credit of sorted) {
      if (used.has(credit.id) || credit.amount <= 0 || !own.has(credit.accountId)) continue;
      if (credit.accountId === debit.accountId) continue;
      const amountDelta = Math.abs(Math.abs(debit.amount) - Math.abs(credit.amount));
      const dayDelta = Math.abs(daysBetween(debit.date, credit.date));
      if (amountDelta <= 1 && dayDelta <= 3) {
        const textBoost = isLikelyTransferText(debit.description) || isLikelyTransferText(credit.description);
        const confidence = textBoost ? 98 : 88;
        const id = `tr_${debit.id}_${credit.id}`;
        const status = decisions[id]?.status;
        if (status !== 'rejected') {
          matches.push({ id, debitTxId: debit.id, creditTxId: credit.id, confidence, reason: 'Samma belopp mellan två egna konton inom tre dagar.' });
          used.add(debit.id);
          used.add(credit.id);
        }
        break;
      }
    }
  }
  return matches;
}

export function transferTxIds(transfers: TransferMatch[], decisions: Record<string, TransferDecision>) {
  const ids = new Set<string>();
  for (const tr of transfers) {
    const status = decisions[tr.id]?.status || 'pending';
    // Treat high-confidence pending transfers as neutral in calculations, but still let user review.
    if (status === 'confirmed' || (status === 'pending' && tr.confidence >= 88)) {
      ids.add(tr.debitTxId);
      ids.add(tr.creditTxId);
    }
  }
  return ids;
}
