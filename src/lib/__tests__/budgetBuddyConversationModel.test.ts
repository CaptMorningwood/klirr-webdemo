import { describe, expect, it } from 'vitest';
import { budgetBuddyConversationEvalCases } from './fixtures/budgetBuddyConversationEvals';

describe('Budget Buddy Conversation 2.0 eval fixture', () => {
  it('covers at least 40 behavior prompts', () => {
    expect(budgetBuddyConversationEvalCases.length).toBeGreaterThanOrEqual(40);
  });
  it('includes required identity, privacy, discussion, action, and out-of-domain prompts', () => {
    for (const prompt of ['Vad är du?', 'Vad kan du göra?', 'Vad såg AI?', 'Jag vill bara resonera, ändra ingenting.', 'Sänk matbudgeten till 5 000.', 'Vem vann fotbollen?']) {
      expect(budgetBuddyConversationEvalCases).toContain(prompt);
    }
  });
});
