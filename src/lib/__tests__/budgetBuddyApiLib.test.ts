import { describe, expect, it } from 'vitest';
// @ts-expect-error JS API helper is tested from Vercel-compatible module
import { executeTool } from '../../../api/_lib/budgetBuddyTools.js';
// @ts-expect-error JS API helper is tested from Vercel-compatible module
import { normalizeMessages, runBudgetBuddyConversation } from '../../../api/_lib/budgetBuddyConversation.js';

const safeContext = { totals: { totalIncome: 35150, fixedExpensesTotal: 22295, variableExpensesTotal: 11255, margin: 1600, remainingAfterFixed: 12855 }, safeLines: { incomeItems: [{ id: 'i', label: 'Lön', amount: 35150 }], fixedItems: [{ id: 'f', label: 'Hyra', amount: 11000, category: 'Boende' }], variableItems: [{ id: 'v', label: 'Mat och hushåll', amount: 6000, category: 'Mat', include: true }] }, counts: { unresolvedReview: 0, recurringCandidates: 0, transfers: 0 }, completion: { percentage: 100, missingItems: [] }, budgetHealth: { score: 72, label: 'Stabil', reasons: ['Marginal finns'] } };

describe('Budget Buddy API tools', () => {
  it('returns overview without raw transaction fields', () => {
    const result = executeTool('get_budget_overview', {}, safeContext);
    expect(result.margin).toBe(1600);
    expect(JSON.stringify(result)).not.toMatch(/transactions|raw|originalDescription|txIds/);
  });
  it('does not create an action for discussion-only wording', () => {
    const result = executeTool('draft_variable_budget', { message: 'Visa vad som händer om jag sänker matbudgeten, men ändra inget.' }, safeContext);
    expect(result.proposedAction).toBeUndefined();
  });
  it('creates validated action for explicit food budget change', () => {
    const result = executeTool('draft_variable_budget', { message: 'Sänk matbudgeten till 5 000.' }, safeContext);
    expect(result.proposedAction?.type).toBe('update_variable_plan');
    expect(result.proposedAction?.status).toBe('pending');
  });
});

describe('Budget Buddy Responses loop', () => {
  it('deduplicates current user message from history', () => {
    expect(normalizeMessages([{ role: 'user', content: 'Vad är du?' }], 'Vad är du?')).toHaveLength(0);
  });
  it('handles tool calls and logs tool usage with a mock OpenAI client', async () => {
    let calls = 0;
    const result = await runBudgetBuddyConversation({ message: 'Hur ser min Budget ut?', safeContext, conversation: { recentMessages: [] }, requestMetadata: { currentDate: '2026-07-13' }, openAiCreate: async () => calls++ === 0 ? { output: [{ type: 'function_call', name: 'get_budget_overview', call_id: 'call_1', arguments: '{}' }] } : { output_text: 'Din Budget har 35 150 kr i inkomst och 1 600 kr marginal.', output: [] } });
    expect(result.toolUsage.usedTools).toContain('get_budget_overview');
    expect(result.message).toContain('1 600');
  });
});
