import type { Entitlements, SubscriptionPlan, SubscriptionStatus } from '../types';

export type EntitlementKey = keyof Entitlements;

export const freeEntitlements: Entitlements = {
  csvImport: true,
  recurringDetection: true,
  budgetBuddy: true,
  scenarios: true,
  export: true,
  cloudSync: true,
  budgetBuddyAdvanced: false,
  deepAnalysis: false,
  proactiveInsights: false,
  budgetHistory: false,
  budgetGoals: false,
  reminders: false,
  automaticReview: false,
  multipleBudgets: false,
  sharedBudget: false,
  versionHistory: false,
};

export const premiumEntitlements: Entitlements = Object.fromEntries(
  Object.keys(freeEntitlements).map(key => [key, true]),
) as unknown as Entitlements;

export function isPremiumPlan(plan: SubscriptionPlan = 'free', status: SubscriptionStatus = 'inactive'): boolean {
  return plan === 'pro' && (status === 'active' || status === 'trialing');
}

export function getEntitlements(plan: SubscriptionPlan = 'free', status: SubscriptionStatus = 'inactive'): Entitlements {
  return { ...(isPremiumPlan(plan, status) ? premiumEntitlements : freeEntitlements) };
}

export function hasEntitlement(entitlements: Entitlements | undefined, feature: EntitlementKey): boolean {
  return Boolean(entitlements?.[feature]);
}

export function normalizeSubscription(plan?: SubscriptionPlan, status?: SubscriptionStatus) {
  const safePlan: SubscriptionPlan = plan === 'pro' ? 'pro' : 'free';
  const safeStatus: SubscriptionStatus = status === 'active' || status === 'trialing' || status === 'past_due' || status === 'inactive' ? status : 'active';
  return { subscriptionPlan: safePlan, subscriptionStatus: safeStatus, entitlements: getEntitlements(safePlan, safeStatus) };
}
