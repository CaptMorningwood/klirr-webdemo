import type { Entitlements, SubscriptionPlan } from '../types';

const unlocked: Entitlements = {
  csvImport: true,
  recurringDetection: true,
  budgetBuddy: true,
  scenarios: true,
  export: true,
  cloudSync: true,
};

export function getEntitlements(_plan: SubscriptionPlan): Entitlements {
  // MVP foundation: all capabilities stay unlocked until real billing exists.
  return { ...unlocked };
}
