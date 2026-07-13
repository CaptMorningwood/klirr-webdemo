import type { Entitlements, SubscriptionPlan } from '../types';

const freeEntitlements: Entitlements = {
  csvImport: true,
  recurringDetection: true,
  budgetBuddy: true,
  scenarios: true,
  export: true,
  cloudSync: true,
  premiumHub: false,
  improvementPlan: false,
  developmentTracking: false,
  smartMonitoring: false,
};

const premiumEntitlements: Entitlements = {
  ...freeEntitlements,
  premiumHub: true,
  improvementPlan: true,
  developmentTracking: true,
  smartMonitoring: true,
};

export function getEntitlements(plan: SubscriptionPlan): Entitlements {
  return plan === 'pro' ? { ...premiumEntitlements } : { ...freeEntitlements };
}
