import type { Account, DetectionResult, RecurringExpense, ReviewItem, Rule, Transaction, TransferDecision } from '../types';
import { clamp, daysBetween } from './format';
import { merchantKey } from './normalize';
import { categorize } from './rulesEngine';
import { matchTransfers, transferTxIds } from './transferMatcher';
import { mean, median, stddev } from './stats';

function frequencyFromIntervals(intervals: number[]) {
  if (!intervals.length) return { frequency: 'irregular' as const, score: 0.25, reason: 'Endast en förekomst.' };
  const avg = mean(intervals);
  const sd = stddev(intervals);
  let frequency: RecurringExpense['frequency'] = 'irregular';
  if (avg >= 24 && avg <= 38) frequency = 'monthly';
  else if (avg >= 75 && avg <= 105) frequency = 'quarterly';
  else if (avg >= 340 && avg <= 390) frequency = 'yearly';
  const score = frequency === 'irregular' ? 0.25 : clamp(1 - sd / Math.max(avg, 1), 0.3, 1);
  return { frequency, score, reason: `Snittintervall ${Math.round(avg)} dagar.` };
}

function monthlyAmountFor(freq: RecurringExpense['frequency'], meanAmount: number) {
  if (freq === 'quarterly') return meanAmount / 3;
  if (freq === 'yearly') return meanAmount / 12;
  return meanAmount;
}

export function detectRecurring(transactions: Transaction[], accounts: Account[], rules: Rule[], transferDecisions: Record<string, TransferDecision>): DetectionResult {
  const transfers = matchTransfers(transactions, accounts, transferDecisions);
  const neutralIds = transferTxIds(transfers, transferDecisions);
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const reviewItems: ReviewItem[] = [];

  const groups: Record<string, Transaction[]> = {};
  for (const t of sorted) {
    if (neutralIds.has(t.id)) continue;
    if (t.amount >= 0) {
      const cat = categorize(t.description, rules);
      if (cat.costType !== 'income' && Math.abs(t.amount) > 1000) {
        reviewItems.push({
          id: `income_${t.id}`,
          type: 'unusual_income',
          txId: t.id,
          description: t.description,
          amount: t.amount,
          date: t.date,
          note: 'Pluspost som inte är intern överföring. Kontrollera om den ska räknas som inkomst, återbetalning eller något annat.',
        });
      }
      continue;
    }
    const cat = categorize(t.description, rules);
    if (cat.costType === 'transfer') continue;
    const key = merchantKey(t.description);
    if (!key) continue;
    groups[key] ||= [];
    groups[key].push(t);
  }

  const recurring: RecurringExpense[] = [];

  for (const [normName, txs] of Object.entries(groups)) {
    const amounts = txs.map(t => Math.abs(t.amount));
    const med = median(amounts);
    const outlierIds = new Set<string>();
    for (const t of txs) {
      const abs = Math.abs(t.amount);
      if (txs.length > 1 && med > 0 && abs > med * 2.4) {
        outlierIds.add(t.id);
        reviewItems.push({
          id: `outlier_${t.id}`,
          type: 'amount_outlier',
          txId: t.id,
          description: t.description,
          amount: t.amount,
          date: t.date,
          note: 'Beloppet avviker kraftigt från övriga poster med samma mottagare. Troligen engångskostnad eller eftersläp.',
        });
      }
    }

    const clean = txs.filter(t => !outlierIds.has(t.id)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!clean.length) continue;

    const dedup: Transaction[] = [];
    const duplicateIds = new Set<string>();
    for (const t of clean) {
      const prev = dedup[dedup.length - 1];
      if (prev && Math.abs(Math.abs(prev.amount) - Math.abs(t.amount)) <= 1 && Math.abs(daysBetween(prev.date, t.date)) <= 4) {
        duplicateIds.add(t.id);
        reviewItems.push({
          id: `dupe_${t.id}`,
          type: 'duplicate',
          txId: t.id,
          description: t.description,
          amount: t.amount,
          date: t.date,
          note: 'Liknar dubbelbetalning nära en annan post med samma belopp. Räknas inte med i normalbeloppet.',
        });
      } else {
        dedup.push(t);
      }
    }

    const occurrences = dedup.length;
    const intervals: number[] = [];
    for (let i = 1; i < dedup.length; i++) intervals.push(daysBetween(dedup[i - 1].date, dedup[i].date));
    const freqInfo = frequencyFromIntervals(intervals);

    const dedupAmounts = dedup.map(t => Math.abs(t.amount));
    const meanAmount = mean(dedupAmounts);
    const minAmount = Math.min(...dedupAmounts);
    const maxAmount = Math.max(...dedupAmounts);
    const amountVarianceRatio = meanAmount > 0 ? (maxAmount - minAmount) / meanAmount : 0;
    const amountScore = clamp(1 - amountVarianceRatio, 0, 1);
    const occScore = clamp(occurrences / 3, 0.15, 1);
    const cat = categorize(normName, rules);
    const knownRuleBoost = cat.source !== 'none' ? 8 : 0;
    const penalty = (duplicateIds.size + outlierIds.size) * 5;
    let confidence = Math.round(occScore * 35 + freqInfo.score * 35 + amountScore * 22 + knownRuleBoost - penalty);
    if (occurrences === 1) confidence = Math.min(confidence, 39);
    confidence = clamp(confidence, 5, 99);

    const monthlyAmount = monthlyAmountFor(freqInfo.frequency, meanAmount);
    const item: RecurringExpense = {
      id: `rec_${normName.replace(/\s+/g, '_')}`,
      normName,
      label: dedup[dedup.length - 1].description,
      category: cat.category,
      costTypeDefault: cat.costType === 'fixed' ? 'fixed' : 'variable',
      frequency: freqInfo.frequency,
      occurrences,
      monthlyAmount,
      meanAmount,
      minAmount,
      maxAmount,
      amountVaries: amountVarianceRatio > 0.12,
      confidence,
      lastDate: dedup[dedup.length - 1].date,
      txIds: dedup.map(t => t.id),
      reason: `${occurrences} förekomst(er). ${freqInfo.reason}${cat.source !== 'none' ? ' Matchar regel/kategori.' : ''}`,
    };

    if (confidence < 50) {
      reviewItems.push({
        id: `lowconf_${item.id}`,
        type: 'low_confidence',
        description: item.label,
        amount: -item.monthlyAmount,
        date: item.lastDate,
        note: 'Osäkert om posten är återkommande. Bekräfta bara om den ska ingå i månadskalkylen.',
        recurringId: item.id,
      });
    }

    recurring.push(item);
  }

  recurring.sort((a, b) => b.confidence - a.confidence || b.monthlyAmount - a.monthlyAmount);
  reviewItems.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return { transfers, recurring, reviewItems };
}
