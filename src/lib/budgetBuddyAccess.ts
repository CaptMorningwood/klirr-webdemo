import type { SubscriptionPlan, SubscriptionStatus } from '../types';

export const buddyCapabilities = [
  'explain_budget',
  'answer_budget_question',
  'explain_budget_health',
  'explain_margin',
  'budget_checkup',
  'import_cleanup',
  'basic_suggestions',
  'basic_actions',
  'crisis_budget',
  'basic_scenarios',
  'improvement_plan',
  'alternative_plans',
  'deep_analysis',
  'goal_aware_advice',
  'development_aware_advice',
  'monitoring_advice',
  'proactive_insight_followup',
] as const;

export type BuddyCapability = (typeof buddyCapabilities)[number];
export type BuddyCapabilityGroup = 'basic' | 'analysis' | 'planning' | 'follow-up';

export const buddyCapabilityGroups: Record<BuddyCapability, BuddyCapabilityGroup> = {
  explain_budget: 'basic',
  answer_budget_question: 'basic',
  explain_budget_health: 'analysis',
  explain_margin: 'analysis',
  budget_checkup: 'analysis',
  import_cleanup: 'basic',
  basic_suggestions: 'basic',
  basic_actions: 'basic',
  crisis_budget: 'planning',
  basic_scenarios: 'planning',
  improvement_plan: 'planning',
  alternative_plans: 'planning',
  deep_analysis: 'analysis',
  goal_aware_advice: 'planning',
  development_aware_advice: 'analysis',
  monitoring_advice: 'follow-up',
  proactive_insight_followup: 'follow-up',
};

export function isBuddyCapability(value: string): value is BuddyCapability {
  return (buddyCapabilities as readonly string[]).includes(value);
}

export function hasBuddyCapability(
  capability: BuddyCapability,
  _plan?: SubscriptionPlan,
  _status?: SubscriptionStatus,
): boolean {
  return isBuddyCapability(capability);
}
