import type { DetectionResult } from '../types';
import { getActionableRecurringCandidates } from './recurrenceEngine';

export type ImportReviewTarget = 'recurring' | 'transfers' | 'review' | 'buddy';
export interface ImportResultSummary {
  importedTransactionCount: number;
  skippedDuplicateCount: number;
  encodingInfo?: { encoding: string; hadReplacementCharacters: boolean };
  possibleIncomeCount: number;
  possibleRecurringExpenseCount: number;
  possibleTransferCount: number;
  unclearReviewItemCount: number;
  recommendedFirstStep: ImportReviewTarget;
  budgetNeedsReview: boolean;
}

export interface ImportChecklistItem {
  id: ImportReviewTarget | 'income';
  label: string;
  buttonLabel: string;
  target: ImportReviewTarget;
}

export function getRecommendedFirstStep(summary: Pick<ImportResultSummary, 'possibleIncomeCount' | 'possibleTransferCount' | 'possibleRecurringExpenseCount' | 'unclearReviewItemCount'>): ImportReviewTarget {
  if (summary.possibleIncomeCount > 0) return 'recurring';
  if (summary.possibleTransferCount > 0) return 'transfers';
  if (summary.possibleRecurringExpenseCount > 0) return 'recurring';
  if (summary.unclearReviewItemCount > 0) return 'review';
  return 'buddy';
}

export function buildImportResultSummary(input: {
  importedTransactionCount: number;
  skippedDuplicateCount: number;
  encodingInfo?: { encoding: string; hadReplacementCharacters: boolean } | null;
  detection: DetectionResult;
}): ImportResultSummary {
  const actionable = getActionableRecurringCandidates(input.detection.recurring);
  const counts = {
    possibleIncomeCount: actionable.filter(item => item.costTypeDefault === 'income').length,
    possibleRecurringExpenseCount: actionable.filter(item => item.costTypeDefault !== 'income').length,
    possibleTransferCount: input.detection.transfers.length,
    unclearReviewItemCount: input.detection.reviewItems.length,
  };
  return {
    importedTransactionCount: input.importedTransactionCount,
    skippedDuplicateCount: input.skippedDuplicateCount,
    encodingInfo: input.encodingInfo || undefined,
    ...counts,
    recommendedFirstStep: getRecommendedFirstStep(counts),
    budgetNeedsReview: counts.possibleIncomeCount + counts.possibleRecurringExpenseCount + counts.possibleTransferCount + counts.unclearReviewItemCount > 0,
  };
}

export function buildImportChecklist(summary: ImportResultSummary): ImportChecklistItem[] {
  const items: ImportChecklistItem[] = [];
  if (summary.possibleIncomeCount > 0) items.push({ id: 'income', label: 'Bekräfta inkomster', buttonLabel: 'Gå till återkommande', target: 'recurring' });
  if (summary.possibleTransferCount > 0) items.push({ id: 'transfers', label: 'Granska överföringar', buttonLabel: 'Gå till överföringar', target: 'transfers' });
  if (summary.possibleRecurringExpenseCount > 0) items.push({ id: 'recurring', label: 'Bekräfta fasta utgifter/återkommande', buttonLabel: 'Gå till återkommande', target: 'recurring' });
  if (summary.unclearReviewItemCount > 0) items.push({ id: 'review', label: 'Kolla oklart', buttonLabel: 'Gå till oklart', target: 'review' });
  items.push({ id: 'buddy', label: 'Kör Budget Buddy Checkup', buttonLabel: 'Städa med Buddy', target: 'buddy' });
  return items;
}

export const importBuddyCleanupMessage = 'Städa min Budget efter importen';
