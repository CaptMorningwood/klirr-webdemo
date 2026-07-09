import type { Account, DetectionResult, RecurringExpense, ReviewItem, Rule, Transaction, TransferDecision } from '../types';
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
  if (category.costType === 'excluded' || category.costType === 'transfer') return 'variable';
  if (direction === 'income') return category.costType === 'income' ? 'income' : 'variable';
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

function isProbablyEverydayVariable(category: string, normName: string) {
  const haystack = `${category} ${normName}`.toLowerCase();
  return [
    'mat och hushåll',
    'restaurang',
    'fika',
    'nöje',
    'bil/transport',
    'parkering',
    'bränsle',
    'okategoriserad',
  ].some(word => haystack.includes(word));
}

function isKnownRecurringLike(category: ReturnType<typeof categorize>, direction: Direction, normName: string) {
  if (direction === 'income') return true;
  if (category.costType === 'fixed') return true;
  return /hyra|försäkring|forsakring|telia|bredband|fiber|gym|lån|lan|finans|leasing|abonnemang|subscription|medlemskap|fack|a-kassa|akassa/i.test(normName);
}

function shouldSurfaceLowConfidence(item: RecurringExpense, direction: Direction, category: ReturnType<typeof categorize>, normName: string) {
  if (item.confidence < 40) return false;
  if (item.occurrences < 2) return false;
  if (item.frequency === 'irregular') return false;
  if (direction === 'income') return item.monthlyAmount >= 1000 || category.costType === 'income';
  if (isProbablyEverydayVariable(item.category, normName) && category.costType !== 'fixed') return false;
  return isKnownRecurringLike(category, direction, normName) || item.monthlyAmount >= 1000;
}

function shouldSurfaceOutlier(direction: Direction, category: ReturnType<typeof categorize>, normName: string, absAmount: number) {
  if (direction === 'income') return absAmount >= 3000;
  if (category.costType === 'fixed') return absAmount >= 300;
  if (isProbablyEverydayVariable(category.category, normName)) return absAmount >= 2500;
  return absAmount >= 1000;
}

function shouldSurfaceDuplicate(direction: Direction, category: ReturnType<typeof categorize>, normName: string, absAmount: number) {
  if (absAmount < 300) return false;
  if (direction === 'income') return true;
  if (category.costType === 'fixed') return true;
  return !isProbablyEverydayVariable(category.category, normName) || absAmount >= 1500;
}

function shouldSurfaceUnusualIncome(t: Transaction, category: ReturnType<typeof categorize>) {
  const abs = Math.abs(t.amount);
  if (category.costType === 'income') return false;
  if (abs < 3000) return false;
  const n = merchantKey(t.description);
  if (/återbetalning|aterbetalning|refund|retur|swish|utlägg|utlagg|ersättning|ersattning/i.test(n) && abs < 10000) return false;
  return true;
}

function uniqueReviewItems(items: ReviewItem[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = `${item.type}|${item.txId || item.recurringId || item.description}|${Math.round(item.amount * 100)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


export function isActionableRecurringCandidate(item: RecurringExpense) {
  if (item.costTypeDefault === 'income' && item.monthlyAmount >= 1000) return true;
  if (item.costTypeDefault === 'fixed' && item.monthlyAmount >= 100) return true;
  if (item.confidence >= 50) return true;
  if (item.occurrences >= 2 && item.costTypeDefault !== 'variable') return true;
  return false;
}

export function actionableCandidateReason(item: RecurringExpense) {
  const singleMonthNote = item.occurrences === 1 ? ' Bara hittad en gång — bekräfta bara om den ska räknas framåt.' : '';
  if (item.costTypeDefault === 'income' && item.monthlyAmount >= 1000) {
    return `Hittad som möjlig inkomst från import. Bekräfta om detta ska räknas som normal månadsinkomst.${singleMonthNote}`;
  }
  if (item.costTypeDefault === 'fixed' && item.monthlyAmount >= 100) {
    return `Hittad som möjlig fast kostnad från import. Bekräfta om detta är ett återkommande måste.${singleMonthNote}`;
  }
  if (item.confidence >= 50) return `Verkar återkommande.${singleMonthNote}`;
  if (item.occurrences >= 2) return `Hittad flera gånger i importen.${singleMonthNote}`;
  return `Importerad transaktion som behöver granskas.${singleMonthNote}`;
}

export function getActionableRecurringCandidates(items: RecurringExpense[]) {
  return items.filter(isActionableRecurringCandidate);
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
    if (cat.costType === 'transfer' || cat.costType === 'excluded') continue;

    const direction: Direction = t.amount >= 0 ? 'income' : 'expense';
    if (direction === 'income' && Math.abs(t.amount) >= 3000) largePositive.push(t);

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
    const groupCategory = categorize(direction === 'income' ? txs[txs.length - 1].description : normName, rules);
    const amounts = txs.map(t => Math.abs(t.amount));
    const med = median(amounts);
    const outlierIds = new Set<string>();

    for (const t of txs) {
      const abs = Math.abs(t.amount);
      if (txs.length > 1 && med > 0 && abs > med * 2.7) {
        outlierIds.add(t.id);
        if (shouldSurfaceOutlier(direction, groupCategory, normName, abs)) {
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
    }

    const clean = txs.filter(t => !outlierIds.has(t.id)).sort((a, b) => parseDate(a.date) - parseDate(b.date));
    if (!clean.length) continue;

    const dedup: Transaction[] = [];
    const duplicateIds = new Set<string>();
    for (const t of clean) {
      const prev = dedup[dedup.length - 1];
      const abs = Math.abs(t.amount);
      if (prev && Math.abs(Math.abs(prev.amount) - abs) <= 1 && Math.abs(daysBetween(prev.date, t.date)) <= 4) {
        duplicateIds.add(t.id);
        if (shouldSurfaceDuplicate(direction, groupCategory, normName, abs)) {
          reviewItems.push({
            id: `dupe_${t.id}`,
            type: 'duplicate',
            txId: t.id,
            description: t.description,
            amount: t.amount,
            date: t.date,
            note: `Liknar en dubbel ${reviewTypeLabel(direction)} nära en annan post med samma belopp. Räknas inte med i normalbeloppet.`,
          });
        }
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
    if (direction === 'expense' && cat.costType !== 'fixed' && isProbablyEverydayVariable(cat.category, normName)) confidence = Math.min(confidence, 49);
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

    if (confidence < 50 && (shouldSurfaceLowConfidence(item, direction, cat, normName) || isActionableRecurringCandidate(item))) {
      reviewItems.push({
        id: `lowconf_${item.id}`,
        type: 'low_confidence',
        description: item.label,
        amount: direction === 'income' ? item.monthlyAmount : -item.monthlyAmount,
        date: item.lastDate,
        note: actionableCandidateReason(item),
        recurringId: item.id,
      });
    }

    recurring.push(item);
  }

  for (const t of largePositive) {
    if (recurringIncomeTxIds.has(t.id)) continue;
    const cat = categorize(t.description, rules);
    if (shouldSurfaceUnusualIncome(t, cat)) {
      reviewItems.push({
        id: `income_${t.id}`,
        type: 'unusual_income',
        txId: t.id,
        description: t.description,
        amount: t.amount,
        date: t.date,
        note: 'Större pluspost som inte verkar vara intern överföring eller bekräftad återkommande inkomst. Kontrollera om den ska räknas som inkomst, återbetalning eller något annat.',
      });
    }
  }

  recurring.sort((a, b) => b.confidence - a.confidence || b.monthlyAmount - a.monthlyAmount);
  const filteredReviewItems = uniqueReviewItems(reviewItems)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 30);
  return { transfers, recurring, reviewItems: filteredReviewItems };
}
