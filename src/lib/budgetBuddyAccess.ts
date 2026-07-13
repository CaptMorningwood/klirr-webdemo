import type { Entitlements } from '../types';

export type BuddyCapability =
  | 'explain_budget'
  | 'answer_budget_question'
  | 'explain_budget_health'
  | 'explain_margin'
  | 'budget_checkup'
  | 'import_cleanup'
  | 'basic_suggestions'
  | 'basic_actions'
  | 'crisis_budget'
  | 'basic_scenarios'
  | 'improvement_plan'
  | 'alternative_plans'
  | 'deep_analysis'
  | 'goal_aware_advice'
  | 'development_aware_advice'
  | 'monitoring_advice'
  | 'proactive_insight_followup';

export type BuddyCapabilityTier = 'core' | 'advanced';

export interface BuddyCapabilityInfo {
  capability: BuddyCapability;
  tier: BuddyCapabilityTier;
  label: string;
  description: string;
  premiumPreview?: string;
}

export const coreBuddyCapabilities: BuddyCapability[] = [
  'explain_budget', 'answer_budget_question', 'explain_budget_health', 'explain_margin', 'budget_checkup',
  'import_cleanup', 'basic_suggestions', 'basic_actions', 'crisis_budget', 'basic_scenarios',
];

export const advancedBuddyCapabilities: BuddyCapability[] = [
  'improvement_plan', 'alternative_plans', 'deep_analysis', 'goal_aware_advice', 'development_aware_advice',
  'monitoring_advice', 'proactive_insight_followup',
];

const info: Record<BuddyCapability, Omit<BuddyCapabilityInfo, 'capability' | 'tier'>> = {
  explain_budget: { label: 'Förklara Budget', description: 'Sammanfattar inkomster, fasta utgifter, Rörliga utgifter och marginal.' },
  answer_budget_question: { label: 'Budgetfråga', description: 'Svarar på enkla frågor om din nuvarande Budget.' },
  explain_budget_health: { label: 'Budgethälsa', description: 'Förklarar Budgethälsa och vad som påverkar den.' },
  explain_margin: { label: 'Marginal', description: 'Förklarar kvar efter fasta utgifter och efter hela planen.' },
  budget_checkup: { label: 'Budget Checkup', description: 'Kör en deterministisk koll av Budgeten.' },
  import_cleanup: { label: 'Importstädning', description: 'Hjälper dig granska importerade återkommande och oklara poster.' },
  basic_suggestions: { label: 'Grundförslag', description: 'Ger grundläggande förbättringsspår.' },
  basic_actions: { label: 'Trygga action cards', description: 'Föreslår åtgärder som kräver bekräftelse.' },
  crisis_budget: { label: 'Krisbudget', description: 'Gör ett tillfälligt stramt Budgetläge.' },
  basic_scenarios: { label: 'Grundscenarier', description: 'Hjälper till med enklare Budgetscenarier.' },
  improvement_plan: { label: 'Förbättringsplan', description: 'Prioriterar Budgetförbättringar.', premiumPreview: 'Prioriterar upp till tre åtgärder och uppskattar möjlig effekt.' },
  alternative_plans: { label: 'Alternativa planer', description: 'Jämför olika vägar framåt.', premiumPreview: 'Jämför Trygg, Balanserad och Mer offensiv.' },
  deep_analysis: { label: 'Fördjupad analys', description: 'Ger djupare Budget Buddy+-analys.', premiumPreview: 'Kombinerar Budgethälsa, marginal och förbättringsspår i en fördjupad analys.' },
  goal_aware_advice: { label: 'Målkopplade råd', description: 'Kopplar råd till aktiva Budgetmål.', premiumPreview: 'Kopplar råden till ditt aktiva Budgetmål.' },
  development_aware_advice: { label: 'Utvecklingsråd', description: 'Använder sparade nulägen och förändringar.', premiumPreview: 'Använder sparade nulägen och förändringar.' },
  monitoring_advice: { label: 'Kollråd', description: 'Prioriterar vad Klirr ska hålla koll på.', premiumPreview: 'Prioriterar vad Klirr ska hålla koll på.' },
  proactive_insight_followup: { label: 'Proaktiv uppföljning', description: 'Följer upp lokala insikter.', premiumPreview: 'Följer upp Klirrs lokala insikter med nästa trygga steg.' },
};

export function buddyCapabilityTier(capability: BuddyCapability): BuddyCapabilityTier {
  return advancedBuddyCapabilities.includes(capability) ? 'advanced' : 'core';
}

export function hasBuddyCapability(entitlements: Entitlements | undefined, capability: BuddyCapability): boolean {
  return buddyCapabilityTier(capability) === 'core' ? Boolean(entitlements?.budgetBuddy) : Boolean(entitlements?.budgetBuddyAdvanced);
}

export function buddyCapabilityInfo(capability: BuddyCapability): BuddyCapabilityInfo {
  return { capability, tier: buddyCapabilityTier(capability), ...info[capability] };
}

export function classifyBuddyRequest(text: string, explicitCapability?: BuddyCapability): BuddyCapability {
  if (explicitCapability) return explicitCapability;
  const q = text.toLowerCase();
  if (/förbättringsplan|min förbättring|prioritera.*åtgärd/.test(q)) return 'improvement_plan';
  if (/alternativa planer|tre alternativa|trygg.*balanserad|offensiv/.test(q)) return 'alternative_plans';
  if (/viktigaste mål|budgetmål|målet/.test(q)) return 'goal_aware_advice';
  if (/budgetutveckling|utveckling|nuläge|förändring/.test(q)) return 'development_aware_advice';
  if (/hålla koll|bevaka|monitorering|påminn/.test(q)) return 'monitoring_advice';
  if (/proaktiv|insikt/.test(q)) return 'proactive_insight_followup';
  if (/djup|fördjup/.test(q)) return 'deep_analysis';
  if (/budgethälsa|hälsa|health/.test(q)) return 'explain_budget_health';
  if (/marginal|kvar/.test(q)) return 'explain_margin';
  if (/checkup|städa|min budget/.test(q)) return 'budget_checkup';
  if (/import|kontoutdrag|csv|oklar|granska/.test(q)) return 'import_cleanup';
  if (/kris|akut|stram/.test(q)) return 'crisis_budget';
  if (/lägg|ändra|uppdatera|skapa regel|flytta/.test(q)) return 'basic_actions';
  if (/scenario|testa/.test(q)) return 'basic_scenarios';
  if (/kapa|spara|minska|förbättra/.test(q)) return 'basic_suggestions';
  if (/förklara|sammanfatta|budget/.test(q)) return 'explain_budget';
  return 'answer_budget_question';
}

export function premiumPreviewText(capability: BuddyCapability): string {
  const details = buddyCapabilityInfo(capability);
  return details.premiumPreview || details.description;
}
