import { describe, expect, it } from 'vitest';
import { freeEntitlements, getEntitlements } from '../entitlements';
import { advancedBuddyCapabilities, buddyCapabilityTier, classifyBuddyRequest, coreBuddyCapabilities, hasBuddyCapability } from '../budgetBuddyAccess';

describe('Budget Buddy capability access', () => {
  it('allows every core capability in Free', () => {
    for (const capability of coreBuddyCapabilities) {
      expect(hasBuddyCapability(freeEntitlements, capability), capability).toBe(true);
      expect(buddyCapabilityTier(capability)).toBe('core');
    }
  });

  it('blocks every advanced capability in Free', () => {
    for (const capability of advancedBuddyCapabilities) {
      expect(hasBuddyCapability(freeEntitlements, capability), capability).toBe(false);
      expect(buddyCapabilityTier(capability)).toBe('advanced');
    }
  });

  it('allows every capability for active Premium and falls back for inactive/past-due Premium', () => {
    const premium = getEntitlements('pro', 'active');
    for (const capability of [...coreBuddyCapabilities, ...advancedBuddyCapabilities]) {
      expect(hasBuddyCapability(premium, capability), capability).toBe(true);
    }
    expect(hasBuddyCapability(getEntitlements('pro', 'past_due'), 'improvement_plan')).toBe(false);
    expect(hasBuddyCapability(getEntitlements('pro', 'inactive'), 'alternative_plans')).toBe(false);
  });

  it('classifies unknown free text as core and known advanced UI intents explicitly as advanced', () => {
    expect(classifyBuddyRequest('Kan du hjälpa mig?')).toBe('answer_budget_question');
    expect(classifyBuddyRequest('Vad är min marginal?')).toBe('explain_margin');
    expect(classifyBuddyRequest('Skapa min förbättringsplan')).toBe('improvement_plan');
    expect(classifyBuddyRequest('vilken text som helst', 'goal_aware_advice')).toBe('goal_aware_advice');
  });
});
