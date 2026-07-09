import type { RecurringDecision, ReviewDecision, ReviewItem } from '../types';

export function getVisibleReviewItems(input: {
  reviewItems: ReviewItem[];
  recurringDecisions: Record<string, RecurringDecision>;
  reviewDecisions?: Record<string, ReviewDecision>;
}) {
  return input.reviewItems.filter(item => {
    if (item.recurringId) {
      const status = input.recurringDecisions[item.recurringId]?.status;
      if (status === 'confirmed' || status === 'rejected') return false;
    }
    const reviewStatus = input.reviewDecisions?.[item.id]?.status;
    if (reviewStatus === 'confirmed' || reviewStatus === 'rejected') return false;
    return true;
  });
}

export function countHandledReviewItems(input: {
  reviewItems: ReviewItem[];
  recurringDecisions: Record<string, RecurringDecision>;
  reviewDecisions?: Record<string, ReviewDecision>;
}) {
  return input.reviewItems.length - getVisibleReviewItems(input).length;
}
