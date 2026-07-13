import { describe, expect, it } from 'vitest';
import { buddyCapabilities, hasBuddyCapability } from '../budgetBuddyAccess';

describe('current Budget Buddy access policy', () => {
  it('makes every defined Buddy capability available regardless of legacy subscription state', () => {
    for (const capability of buddyCapabilities) {
      expect(hasBuddyCapability(capability, 'free', 'inactive')).toBe(true);
      expect(hasBuddyCapability(capability, 'free', 'active')).toBe(true);
      expect(hasBuddyCapability(capability, 'pro', 'active')).toBe(true);
      expect(hasBuddyCapability(capability, 'pro', 'past_due')).toBe(true);
    }
  });
});
