import type { Account, CostType, DetectionResult, RecurringExpense, ReviewItem, Rule, Transaction, TransferDecision } from '../types';
import { clamp, daysBetween } from './format';
import { merchantKey } from './normalize';
import { categorize } from './rulesEngine';
import { matchTransfers, transferTxIds } from './transferMatcher';
import { mean, median, stddev } from './stats';

type Direction = 'expense' | 'income';

function parseDate(date: string) {
  return new Date(`${date}T12:00:00`).getTime();
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function dayOfMonth(date: string) {
  const n = Number(date.slice(8, 10));
  return Number.isFinite(n) ? n : 0;
}

function frequencyFromDates(txs: Transaction[]) {
  if (txs.length < 2) return { frequency: 'irregular' as const, score: 0.22, reason: 'Bara en förekomst hittad.' };

  const intervals: number[] = [];
  for (let i = 1; i < txs.length; i++) intervals.push(daysBetween(txs[i - 1].date, txs[i].date));

  const avg = mean(intervals);
  const sd = stddev(intervals);
  const days = txs.map(t => dayOfMonth(t.date)).filter(Boolean);
  const daySd = days.length > 1 ? stddev(days) : 0;
  const distinctMonths = new Set(txs.map(t => monthKey(t.date))).size;
  const monthCoverage = distinctMonths / txs.length;

  let frequency: RecurringExpense['frequency'] = 'irregular';
  let baseScore = 0.25;
  let reason = `Snittintervall ${Math.round(avg)} dagar.`;

  if (avg >= 24 && avg <= 38) {
    frequency = 'monthly';
    const intervalScore = clamp(1 - sd / 10, 0.45, 1);
    const dayScore = clamp(1 - daySd / 10, 0.55, 1);
    const coverageScore = monthCoverage >= 0.8 ? 1 : 0.75;
    baseScore = clamp((intervalScore * 0.55) + (dayScore * 0.25) + (coverageScore * 0.2), 0.45, 1);
    reason = `Verkar månadsvis: ${Math.round(avg)} dagar i snitt${daySd <= 4 ? ', ungefär samma dag i månaden' : ''}.`;
  } else if (avg >= 75 && avg <= 105) {
    frequency = 'quarterly';
    baseScore = clamp(1 - sd / 22, 0.45, 1);
    reason = `Verkar kvartalsvis: ${Math.round(avg)} dagar i snitt.`;
  } else if (avg >= 340 && avg <= 390) {
    frequency = 'yearly';
    baseScore = clamp(1 - sd / 45, 0.45, 1);
    reason = `Verkar årsvis: ${Math.round(avg)} dagar i snitt.`;
  }

  return { frequency, score: baseScore, reason };
}

function monthlyAmountFor(freq: RecurringExpense['frequency'], meanAmount: number) {
  if (freq === 'quarterly') return meanAmount / 3;
  if (freq === 'yearly') return meanAmount / 12;
  return meanAmount;
}

function defaultCostType(direction: Direction, category: ReturnType<typeof categorize>): 'fixed' | 'variable' | 'income' {
  if (direction === 'income') return 'income';
  if (category.costType === 'fixed') return 'fixed';
  return 'variable';
}

function groupKey(t: Transaction, direction: Direction) {
  const key = merchantKey(t.description);
  if (!key) return '';
  return `${direction}:${key}`;
}

function reviewTypeLabel(direction: Direction) {
  return direction === 'income' ? 'inkomst' : 'utgift';
}

export function detectRecurring(transactions: Transaction[], accounts: Account[], rules: Rule[], transferDecisions: Record<string, TransferDecision>): DetectionResult {
  const transfers = matchTransfers(transactions, accounts, transferDecisions);
  const neutralIds = transferTxIds(transfers, transferDecisions);
  const sorted = [...transactions].sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const reviewItems: ReviewItem[] = [];

  const groups: Record<string, { direction: Direction; txs: Transaction[] }> = {};
  const largePositive: Transaction[] = [];

  for (const t of sorted) {
    if (neutralIds.has(t.id)) continue;
    const cat = categorize(t.description, rules);
    if (cat.costType === 'transfer') continue;

    const direction: Direction = t.amount >= 0 ? 'income' : 'expense';
    if (direction === 'income' && Math.abs(t.amount) > 1000) largePositive.push(t);

    const key = groupKey(t, direction);
    if (!key) continue;
    groups[key] ||= { direction, txs: [] };
    groups[key].txs.push(t);
  }

  const recurring: RecurringExpense[] = [];
  const recurringIncomeTxIds = new Set<string>();

  for (const [rawKey, group] of Object.entries(groups)) {
    const { direction, txs } = group;
    const normName = rawKey.replace(/^(expense|income):/, '');
    const amounts = txs.map(t => Math.abs(t.amount));
    const med = median(amounts);
    const outlierIds = new Set<string>();

    for (const t of txs) {
      const abs = Math.abs(t.amount);
      if (txs.length > 1 && med > 0 && abs > med * 2.7) {
        outlierIds.add(t.id);
        reviewItems.push({
          id: `outlier_${t.id}`,
          type: 'amount_outlier',
          txId: t.id,
          description: t.description,
          amount: t.amount,
          date: t.date,
          note: `Beloppet avviker kraftigt från övriga ${reviewTypeLabel(direction)}er med samma namn. Troligen engångspost eller eftersläp.`,
        });
      }
    }

    const clean = txs.filter(t => !outlierIds.has(t.id)).sort((a, b) => parseDate(a.date) - parseDate(b.date));
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
          note: `Liknar en dubbel ${reviewTypeLabel(direction)} nära en annan post med samma belopp. Räknas inte med i normalbeloppet.`,
        });
      } else {
        dedup.push(t);
      }
    }

    const occurrences = dedup.length;
    if (!occurrences) continue;

    const freqInfo = frequencyFromDates(dedup);
    const dedupAmounts = dedup.map(t => Math.abs(t.amount));
    const meanAmount = mean(dedupAmounts);
    const minAmount = Math.min(...dedupAmounts);
    const maxAmount = Math.max(...dedupAmounts);
    const amountVarianceRatio = meanAmount > 0 ? (maxAmount - minAmount) / meanAmount : 0;
    const amountScore = clamp(1 - amountVarianceRatio * 0.7, 0.25, 1);
    const occScore = occurrences === 1 ? 0.18 : occurrences === 2 ? 0.72 : occurrences === 3 ? 0.92 : 1;
    const cat = categorize(direction === 'income' ? dedup[dedup.length - 1].description : normName, rules);
    const costTypeDefault = defaultCostType(direction, cat);
    const knownRuleBoost = cat.source !== 'none' ? 9 : 0;
    const incomeBoost = direction === 'income' && /lön|lon|salary|barnbidrag|försäkringskassan|forsakringskassan|csn|pension|skatteverket/i.test(normName) ? 10 : 0;
    const penalty = (duplicateIds.size + outlierIds.size) * 5;
    let confidence = Math.round(occScore * 34 + freqInfo.score * 34 + amountScore * 20 + knownRuleBoost + incomeBoost - penalty);
    if (occurrences === 1) confidence = Math.min(confidence, 39);
    if (freqInfo.frequency === 'irregular') confidence = Math.min(confidence, occurrences >= 3 ? 59 : 44);
    confidence = clamp(confidence, 5, 99);

    const monthlyAmount = monthlyAmountFor(freqInfo.frequency, meanAmount);
    const item: RecurringExpense = {
      id: `rec_${rawKey.replace(/[^a-z0-9åäö]+/gi, '_')}`,
      normName,
      label: dedup[dedup.length - 1].description,
      category: direction === 'income' && cat.source === 'none' ? 'Inkomst' : cat.category,
      costTypeDefault,
      frequency: freqInfo.frequency,
      occurrences,
      monthlyAmount,
      meanAmount,
      minAmount,
      maxAmount,
      amountVaries: amountVarianceRatio > 0.18,
      confidence,
      lastDate: dedup[dedup.length - 1].date,
      txIds: dedup.map(t => t.id),
      reason: `${occurrences} förekomst(er). ${freqInfo.reason}${cat.source !== 'none' ? ' Matchar regel/kategori.' : ''}`,
    };

    if (direction === 'income') dedup.forEach(t => recurringIncomeTxIds.add(t.id));

    if (confidence < 50) {
      reviewItems.push({
        id: `lowconf_${item.id}`,
        type: 'low_confidence',
        description: item.label,
        amount: direction === 'income' ? item.monthlyAmount : -item.monthlyAmount,
        date: item.lastDate,
        note: direction === 'income'
          ? 'Osäkert om inkomsten är återkommande. Bekräfta bara om den ska räknas som normal månadsinkomst.'
          : 'Osäkert om posten är återkommande. Bekräfta bara om den ska ingå i månadskalkylen.',
        recurringId: item.id,
      });
    }

    recurring.push(item);
  }

  for (const t of largePositive) {
    if (recurringIncomeTxIds.has(t.id)) continue;
    const cat = categorize(t.description, rules);
    if (cat.costType !== 'income') {
      reviewItems.push({
        id: `income_${t.id}`,
        type: 'unusual_income',
        txId: t.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
        note: 'Pluspost som inte verkar vara intern överföring eller bekräftad återkommande inkomst. Kontrollera om den ska räknas som inkomst, återbetalning eller något annat.',
      });
    }
  }

  recurring.sort((a, b) => b.confidence - a.confidence || b.monthlyAmount - a.monthlyAmount);
  reviewItems.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return { transfers, recurring, reviewItems };
}
