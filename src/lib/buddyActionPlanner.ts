import type { BuddyProposedAction, HouseholdProfile, Income, VariablePlanItem } from '../types';
import { uid } from './format';
import { estimateSwedishNetSalary } from './taxEstimate';
import { selectIncomeTargetForSalaryUpdate } from './incomeTargeting';
import { suggestVariableBudget } from './budgetSuggestionEngine';

export type BuddyActionPlanIntent = 'salary_estimate_update_income' | 'update_variable_budget' | 'income_disambiguation_needed' | 'troubleshooting' | 'none';
export type BuddyActionPlanConfidence = 'high' | 'medium' | 'low';

export interface BuddyActionPlan {
  intent: BuddyActionPlanIntent;
  confidence: BuddyActionPlanConfidence;
  proposedAction?: BuddyProposedAction;
  clarificationQuestion?: string;
  explanationHints?: string[];
  missingInfo?: string[];
}

export interface BuddyActionPlannerInput {
  message: string;
  context?: any;
  incomes?: Income[];
  variablePlan?: VariablePlanItem[];
  householdProfile?: HouseholdProfile;
  pendingAction?: BuddyProposedAction | null;
}

function formatKr(amount: number) {
  return `${Math.round(amount).toLocaleString('sv-SE')} kr`;
}

export function extractGrossSalary(message: string): number | null {
  const text = message.toLowerCase().replace(/\s+/g, ' ');
  const salaryIntent = /(lön|lon|inkomst|brutto|netto|efter skatt|skatt|tjänar|tjanar|får ut|far ut|går upp|gar upp)/i.test(text);
  if (!salaryIntent) return null;
  const amounts = [...text.matchAll(/(\d[\d\s]{3,})(?:\s*kr)?/g)]
    .map(match => Number(match[1].replace(/\s/g, '')))
    .filter(amount => amount >= 10000 && amount < 500000);
  return amounts[0] || null;
}

function isSalaryIntentWithoutAmount(message: string) {
  return /(lön|lon|brutto|efter skatt|netto|tjänar|tjanar|får ut|far ut|inkomst)/i.test(message) && !extractGrossSalary(message);
}

function saysNoChange(message: string) {
  return /(ändra inget|andra inget|uppdatera inte|lägg inte till|lagg inte till|bara räkna|bara rakna|vill inte ändra)/i.test(message.toLowerCase());
}

function isTroubleshooting(message: string) {
  return /(varför|varfor|hände inget|hande inget|dök ingen|dok ingen|uppdaterades inte|ändrades inte|andrades inte|gjorde du|uppdaterade du|var sparas|vad måste jag göra)/i.test(message.toLowerCase());
}

function variableBudgetIntent(message: string) {
  return /(tryggare|försiktig|forsiktig|rörlig budget|rörliga budget|budgetförslag|budgetforslag|föreslå.*budget|foresla.*budget|gör budgeten|gor budgeten|dra ner|minska .*budget|lägg mer på|lagg mer pa|använd trygg budget|anvand trygg budget)/i.test(message.toLowerCase());
}

function makeIncomeAction(message: string, incomes: Income[], context?: any): BuddyActionPlan {
  const gross = extractGrossSalary(message);
  if (!gross) {
    return { intent: 'salary_estimate_update_income', confidence: 'medium', clarificationQuestion: 'Vilken bruttolön vill du att jag räknar på? Skriv gärna till exempel “50 000 kr brutto” 🧾', missingInfo: ['grossMonthly'] };
  }
  const estimate = estimateSwedishNetSalary({ grossMonthly: gross, municipalTaxRate: context?.householdProfile?.municipalTaxRate });
  if (saysNoChange(message)) {
    return { intent: 'salary_estimate_update_income', confidence: 'high', explanationHints: [`${formatKr(gross)} brutto blir ungefär ${formatKr(estimate.netMonthly)} efter skatt med 32% antagande.`, 'Användaren ville inte ändra något.'] };
  }

  const targeting = selectIncomeTargetForSalaryUpdate(incomes, message);
  const notes = `Grovt uppskattad från ${formatKr(gross)} brutto med ${(estimate.taxRate * 100).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}% skatt. Exakt nettolön beror på kommun, skattetabell, ålder och avdrag.`;

  if (targeting.strategy === 'needs_user_choice') {
    const candidates = (targeting.candidateIncomes || incomes).map(income => ({ incomeId: income.id, label: income.label, amount: income.amount }));
    return {
      intent: 'income_disambiguation_needed',
      confidence: 'high',
      proposedAction: { id: uid('buddy_action'), type: 'choose_income_to_update', title: 'Välj inkomst att ändra', description: `Jag räknar ${formatKr(gross)} brutto till ungefär ${formatKr(estimate.netMonthly)} efter skatt. Vilken inkomst ska ersättas?`, payload: { suggestedAmount: estimate.netMonthly, suggestedLabel: 'Lön efter skatt', grossMonthly: gross, estimatedNetMonthly: estimate.netMonthly, candidateIncomes: candidates, notes }, cancelLabel: 'Nej, låt allt vara', status: 'pending' },
      clarificationQuestion: 'Vilken inkomst vill du att jag ska ersätta med den nya lönen?',
      explanationHints: [targeting.reason],
    };
  }

  const existing = targeting.incomeId ? incomes.find(income => income.id === targeting.incomeId) : undefined;
  const replaceMode = targeting.strategy === 'add_new' ? 'add_new' : 'update_existing';
  const label = existing?.label || 'Lön efter skatt';
  return {
    intent: 'salary_estimate_update_income',
    confidence: 'high',
    proposedAction: { id: uid('buddy_action'), type: 'update_income', title: replaceMode === 'add_new' ? 'Lägg till inkomst' : 'Uppdatera inkomst', description: replaceMode === 'add_new' ? `Lägg till “${label}” på cirka ${formatKr(estimate.netMonthly)}/mån.` : `Ändra “${label}” från ${formatKr(existing?.amount || 0)} till cirka ${formatKr(estimate.netMonthly)}/mån.`, payload: { incomeId: targeting.incomeId, replaceMode, label, amount: estimate.netMonthly, frequency: 'monthly', source: 'buddy', notes }, confirmLabel: replaceMode === 'add_new' ? 'Ja, lägg till inkomsten' : `Ja, ändra ${label}`, cancelLabel: 'Nej, låt den vara', status: 'pending' },
    explanationHints: [targeting.reason, notes],
  };
}

function makeVariablePlanAction(input: BuddyActionPlannerInput): BuddyActionPlan {
  const summary = input.context?.summary || {};
  const available = Number(summary.remainingAfterFixed ?? input.context?.remainingAfterFixed ?? 0);
  if (!Number.isFinite(available) || available <= 0) {
    return { intent: 'update_variable_budget', confidence: 'medium', clarificationQuestion: 'Jag behöver veta ungefär vad som finns kvar efter måsten innan jag föreslår en trygg rörlig budget 💡', missingInfo: ['remainingAfterFixed'] };
  }
  const suggestion = input.context?.budgetSuggestion || suggestVariableBudget({ available, mode: 'safe', householdProfile: input.householdProfile, currentVariablePlan: input.variablePlan });
  const items = Array.isArray(suggestion.items) ? suggestion.items : [];
  if (!items.length) return { intent: 'update_variable_budget', confidence: 'low', missingInfo: ['variablePlan'] };
  return { intent: 'update_variable_budget', confidence: 'high', proposedAction: { id: uid('buddy_action'), type: 'update_variable_plan', title: 'Använd trygg rörlig budget', description: 'Ersätt den rörliga planen med ett tryggare förslag. Inget ändras förrän du säger ja.', payload: { items: items.map((item: any) => ({ id: item.id, label: item.label, amount: Math.max(0, Math.round(Number(item.amount || 0))), category: item.category || 'Rörligt', include: item.include !== false })), marginLeft: Number(suggestion.marginLeft ?? suggestion.buffer ?? available), mode: 'safe', notes: suggestion.note || 'Förslaget är beräknat deterministiskt av Klirr.' }, confirmLabel: 'Ja, använd budgeten', cancelLabel: 'Nej, behåll nuvarande', status: 'pending' } };
}

export function planBuddyAction(input: BuddyActionPlannerInput): BuddyActionPlan {
  const message = input.message || '';
  const incomes = input.incomes || input.context?.incomes || [];
  if (isTroubleshooting(message)) return { intent: 'troubleshooting', confidence: 'high', explanationHints: ['Användaren felsöker tidigare Budget Buddy-action.'] };
  if (extractGrossSalary(message) || isSalaryIntentWithoutAmount(message)) return makeIncomeAction(message, incomes, input.context);
  if (variableBudgetIntent(message)) return makeVariablePlanAction(input);
  return { intent: 'none', confidence: 'low' };
}
