import { describe, expect, it } from 'vitest';
import { calculateBudget } from '../budgetCalculator';
import { getVisibleReviewItems } from '../reviewVisibility';
import type { DetectionResult } from '../../types';

const detection: DetectionResult = {
  transfers: [],
  recurring: [{ id: 'rec_income', normName: 'lon', label: 'LÖN', category: 'Lön', costTypeDefault: 'income', frequency: 'monthly', occurrences: 2, monthlyAmount: 30000, meanAmount: 30000, minAmount: 30000, maxAmount: 30000, amountVaries: false, confidence: 80, lastDate: '2026-06-25', txIds: [], reason: 'Månadsvis pluspost' }],
  reviewItems: [
    { id: 'review_rec', recurringId: 'rec_income', type: 'low_confidence', description: 'LÖN', amount: 30000, note: 'Kontrollera', date: '2026-06-25' },
    { id: 'review_oneoff', type: 'unusual_income', description: 'Swish', amount: 1000, note: 'Oklart', date: '2026-06-20' },
  ],
};

describe('review visibility', () => {
  it('hides recurring review item after confirm and lets summary include it', () => {
    const recurringDecisions = { rec_income: { status: 'confirmed' as const } };
    expect(getVisibleReviewItems({ reviewItems: detection.reviewItems, recurringDecisions, reviewDecisions: {} }).map(i => i.id)).not.toContain('review_rec');
    expect(calculateBudget({ detection, recurringDecisions, incomes: [], manualExpenses: [], variablePlan: [] }).totalIncome).toBe(30000);
  });

  it('hides recurring review item after reject and keeps it out of summary', () => {
    const recurringDecisions = { rec_income: { status: 'rejected' as const } };
    expect(getVisibleReviewItems({ reviewItems: detection.reviewItems, recurringDecisions, reviewDecisions: {} }).map(i => i.id)).not.toContain('review_rec');
    expect(calculateBudget({ detection, recurringDecisions, incomes: [], manualExpenses: [], variablePlan: [] }).totalIncome).toBe(0);
  });

  it('hides non-recurring review item after saved review decision without changing budget', () => {
    const visible = getVisibleReviewItems({ reviewItems: detection.reviewItems, recurringDecisions: {}, reviewDecisions: { review_oneoff: { status: 'rejected' } } });
    expect(visible.map(i => i.id)).not.toContain('review_oneoff');
    expect(calculateBudget({ detection, recurringDecisions: {}, incomes: [], manualExpenses: [], variablePlan: [] }).totalIncome).toBe(0);
  });
});
