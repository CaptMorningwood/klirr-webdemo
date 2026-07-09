import { describe, expect, it } from 'vitest';
import { buildImportChecklist, buildImportResultSummary, getRecommendedFirstStep, importBuddyCleanupMessage } from '../importSummary';
import type { DetectionResult } from '../../types';

const baseDetection: DetectionResult = { transfers: [], recurring: [], reviewItems: [] };

function detection(overrides: Partial<DetectionResult>): DetectionResult {
  return { ...baseDetection, ...overrides };
}

describe('post-import summary guidance', () => {
  it('counts imported rows, skipped duplicates and detected recurring types', () => {
    const summary = buildImportResultSummary({ importedTransactionCount: 7, skippedDuplicateCount: 2, detection: detection({ recurring: [
      { id: 'rec_salary', normName: 'salary', label: 'Lön', category: 'Lön', costTypeDefault: 'income', frequency: 'monthly', occurrences: 1, monthlyAmount: 30000, meanAmount: 30000, minAmount: 30000, maxAmount: 30000, amountVaries: false, confidence: 90, lastDate: '2026-06-25', txIds: ['tx1'], reason: 'Månadsvis pluspost' },
      { id: 'rec_rent', normName: 'rent', label: 'Hyra', category: 'Boende', costTypeDefault: 'fixed', frequency: 'monthly', occurrences: 1, monthlyAmount: 10000, meanAmount: 10000, minAmount: 10000, maxAmount: 10000, amountVaries: false, confidence: 90, lastDate: '2026-06-01', txIds: ['tx2'], reason: 'Månadsvis utgift' },
    ] }) });
    expect(summary.importedTransactionCount).toBe(7);
    expect(summary.skippedDuplicateCount).toBe(2);
    expect(summary.possibleIncomeCount).toBe(1);
    expect(summary.possibleRecurringExpenseCount).toBe(1);
  });

  it('keeps encoding warning details when relevant', () => {
    const summary = buildImportResultSummary({ importedTransactionCount: 1, skippedDuplicateCount: 0, encodingInfo: { encoding: 'windows-1252', hadReplacementCharacters: true }, detection: baseDetection });
    expect(summary.encodingInfo).toEqual({ encoding: 'windows-1252', hadReplacementCharacters: true });
  });

  it('prioritizes incomes before transfers and recurring expenses', () => {
    expect(getRecommendedFirstStep({ possibleIncomeCount: 1, possibleTransferCount: 1, possibleRecurringExpenseCount: 1, unclearReviewItemCount: 1 })).toBe('recurring');
    expect(getRecommendedFirstStep({ possibleIncomeCount: 0, possibleTransferCount: 1, possibleRecurringExpenseCount: 1, unclearReviewItemCount: 1 })).toBe('transfers');
  });

  it('builds checklist buttons only for detected cleanup work plus Budget Buddy', () => {
    const summary = buildImportResultSummary({
      importedTransactionCount: 3,
      skippedDuplicateCount: 0,
      detection: detection({
        transfers: [{ id: 'tr_1', debitTxId: 'tx_out', creditTxId: 'tx_in', confidence: 90, reason: 'same amount' }],
        reviewItems: [{ id: 'rev_1', type: 'low_confidence', description: 'Oklar', amount: -123, note: 'Kolla' }],
      }),
    });
    expect(buildImportChecklist(summary)).toEqual([
      expect.objectContaining({ label: 'Granska överföringar', target: 'transfers' }),
      expect.objectContaining({ label: 'Kolla oklart', target: 'review' }),
      expect.objectContaining({ label: 'Kör Budget Buddy Checkup', target: 'buddy' }),
    ]);
  });

  it('uses cleanup handoff message without transaction data', () => {
    expect(importBuddyCleanupMessage).toBe('Städa min budget efter importen');
    expect(importBuddyCleanupMessage).not.toMatch(/\d{4}-\d{2}-\d{2}|;|,/);
  });
});
