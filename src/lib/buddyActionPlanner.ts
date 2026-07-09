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
  recentMessages?: Array<{ role?: string; content?: string }>;
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
  const text = message.toLowerCase();
  const directPlan = /(rörlig(?:a)? plan(?:en)?|ny(?:\s+rörlig)?\s+plan|lägg upp en plan|lagg upp en plan|gör en plan|gor en plan|ändra planen|andra planen|justera planen|använd planen|anvand planen|kör på planen|kor pa planen|fördela pengarna|fordela pengarna|planera det rörliga|vardagsbudget)/i.test(text);
  const changePlan = /(mer buffert|mer sparande|mindre mat|mer nöje|mer noje|lägg .* på nöje|lagg .* pa noje|lägg .* på buffert|lagg .* pa buffert|minska .*mat|dra ner .*mat)/i.test(text);
  const budgetPlan = /(tryggare|försiktig|forsiktig|tajtare).*(rörlig|plan|budget)|(?:rörlig|rörliga) budget|budgetförslag|budgetforslag|föreslå.*budget|foresla.*budget|gör budgeten|gor budgeten|använd trygg budget|anvand trygg budget/i.test(text);
  return directPlan || changePlan || budgetPlan;
}

function variablePlanConfirmationIntent(message: string) {
  return /^(\s*)(ja[,! ]*)?(gör så|gor sa|kör på det|kor pa det|kör på den|kor pa den|lägg in den|lagg in den|använd den(?: planen)?|anvand den(?: planen)?|det låter bra|det later bra|låter bra|later bra|så kör vi|sa kor vi)(\s*[!.]*)?$/i.test(message.toLowerCase());
}

const categoryAliases = [
  { label: 'Mat och hushåll', category: 'Mat', pattern: /mat(?:\s+och\s+hushåll)?|hushåll/i },
  { label: 'Transport rörligt', category: 'Transport', pattern: /transport(?:\s+rörligt)?|buss|bil|resor/i },
  { label: 'Nöje', category: 'Nöje', pattern: /nöje|noje/i },
  { label: 'Övrigt hushåll', category: 'Övrigt', pattern: /övrigt(?:\s+hushåll)?|ovrigt(?:\s+hushall)?/i },
  { label: 'Buffert/sparande', category: 'Buffert', pattern: /buffert|sparande/i },
];

function parseAmount(raw: string) {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value) : NaN;
}

export function extractVariablePlanItemsFromText(text: string): Array<{ label: string; amount: number; category: string; include: boolean }> {
  const source = text.replace(/\u00a0/g, ' ');
  const found = new Map<string, { label: string; amount: number; category: string; include: boolean }>();
  for (const alias of categoryAliases) {
    const categorySource = alias.pattern.source;
    const before = new RegExp(`(?:${categorySource})[^0-9]{0,30}(?:runt|ca|cirka|på|pa|till)?\\s*(\\d[\\d\\s]*(?:[,.]\\d+)?)\\s*(?:kr|kronor)?`, 'i');
    const after = new RegExp(`(?:lägg|lagg|sätt|satt|ha)?\\s*(\\d[\\d\\s]*(?:[,.]\\d+)?)\\s*(?:kr|kronor)?\\s*(?:på|pa|till|i)?\\s*(?:${categorySource})`, 'i');
    const match = source.match(before) || source.match(after);
    if (!match) continue;
    const amount = parseAmount(match[1]);
    if (Number.isFinite(amount) && amount >= 0 && amount < 100000) found.set(alias.label, { label: alias.label, amount, category: alias.category, include: true });
  }
  return [...found.values()];
}

function recentVariablePlanText(input: BuddyActionPlannerInput) {
  const recent = input.recentMessages || input.context?.recentMessages || input.context?.chatMessages || [];
  return Array.isArray(recent) ? recent.slice(-8).map((m: any) => String(m?.content || '')).join('\n') : '';
}

function recentDiscussionWasVariablePlan(input: BuddyActionPlannerInput) {
  const text = recentVariablePlanText(input);
  return variableBudgetIntent(text) || extractVariablePlanItemsFromText(text).length >= 3;
}

function incomeKey(income: Pick<Income, 'id' | 'label'>) {
  return `${income.id}::${income.label}`;
}

function collectIncomeCandidates(inputIncomes: Income[] = [], context?: any): Income[] {
  const seen = new Set<string>();
  const add = (income: Income, out: Income[]) => {
    const key = incomeKey(income);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(income);
    }
  };
  const candidates: Income[] = [];
  inputIncomes.forEach(income => add(income, candidates));
  const summaryItems = context?.summary?.incomeItems || context?.incomeItems || [];
  if (Array.isArray(summaryItems)) {
    summaryItems.forEach((item: any) => {
      if (!item?.id || !item?.label) return;
      add({ id: String(item.id), label: String(item.label), amount: Number(item.amount || 0), frequency: item.frequency || 'monthly', notes: item.source === 'recurring' ? 'imported_confirmed' : undefined }, candidates);
    });
  }
  return candidates;
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

  const allIncomeCandidates = collectIncomeCandidates(incomes, context);
  const targeting = selectIncomeTargetForSalaryUpdate(allIncomeCandidates, message);
  const notes = `Grovt uppskattad från ${formatKr(gross)} brutto med ${(estimate.taxRate * 100).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}% skatt. Exakt nettolön beror på kommun, skattetabell, ålder och avdrag.`;

  if (targeting.strategy === 'needs_user_choice') {
    const candidates = (targeting.candidateIncomes || allIncomeCandidates).map(income => ({ incomeId: income.id, label: income.label, amount: income.amount }));
    return {
      intent: 'income_disambiguation_needed',
      confidence: 'high',
      proposedAction: { id: uid('buddy_action'), type: 'choose_income_to_update', title: 'Välj inkomst att ändra', description: `Jag räknar ${formatKr(gross)} brutto till ungefär ${formatKr(estimate.netMonthly)} efter skatt. Vilken inkomst ska ersättas?`, payload: { suggestedAmount: estimate.netMonthly, suggestedLabel: 'Lön efter skatt', grossMonthly: gross, estimatedNetMonthly: estimate.netMonthly, candidateIncomes: candidates, notes }, cancelLabel: 'Nej, låt allt vara', status: 'pending' },
      clarificationQuestion: 'Vilken inkomst vill du att jag ska ersätta med den nya lönen?',
      explanationHints: [targeting.reason],
    };
  }

  const existing = targeting.incomeId ? allIncomeCandidates.find(income => income.id === targeting.incomeId) : undefined;
  const existingIsManual = !!(existing && incomes.some(income => income.id === existing.id));
  if (existing && !existingIsManual) {
    return {
      intent: 'income_disambiguation_needed',
      confidence: 'high',
      clarificationQuestion: `Jag hittade “${existing.label}” som trolig lön, men den kommer från importerade bekräftade inkomster. Uppdatera den importerade posten manuellt eller be mig lägga till en ny “Lön efter skatt” i stället.`,
      explanationHints: [targeting.reason, 'Importerade bekräftade inkomster ändras inte via update_income, och stödinkomster används aldrig som workaround.'],
    };
  }

  const replaceMode = targeting.strategy === 'add_new' ? 'add_new' : 'update_existing';
  const label = existing?.label || 'Lön efter skatt';
  return {
    intent: 'salary_estimate_update_income',
    confidence: 'high',
    proposedAction: { id: uid('buddy_action'), type: 'update_income', title: replaceMode === 'add_new' ? 'Lägg till inkomst' : 'Uppdatera inkomst', description: replaceMode === 'add_new' ? `Fält som ändras: Inkomst “${label}”. Lägg till cirka ${formatKr(estimate.netMonthly)}/mån.` : `Fält som ändras: Inkomst “${label}”. Ändra från ${formatKr(existing?.amount || 0)} till cirka ${formatKr(estimate.netMonthly)}/mån.`, payload: { incomeId: targeting.incomeId, replaceMode, label, amount: estimate.netMonthly, frequency: 'monthly', source: 'buddy', notes }, confirmLabel: replaceMode === 'add_new' ? 'Ja, lägg till inkomsten' : `Ja, ändra ${label}`, cancelLabel: 'Nej, låt den vara', status: 'pending' },
    explanationHints: [targeting.reason, notes],
  };
}

function makeVariablePlanAction(input: BuddyActionPlannerInput): BuddyActionPlan {
  const summary = input.context?.summary || {};
  const available = Number(summary.remainingAfterFixed ?? input.context?.remainingAfterFixed ?? 0);
  if (!Number.isFinite(available) || available <= 0) {
    return { intent: 'update_variable_budget', confidence: 'medium', clarificationQuestion: 'Jag behöver veta ungefär vad som finns kvar efter måsten innan jag föreslår en trygg rörlig budget 💡', missingInfo: ['remainingAfterFixed'] };
  }
  const explicitItems = extractVariablePlanItemsFromText(`${input.message}\n${recentVariablePlanText(input)}`);
  const suggestion = input.context?.budgetSuggestion || suggestVariableBudget({ available, mode: 'safe', householdProfile: input.householdProfile, currentVariablePlan: input.variablePlan });
  const items = explicitItems.length >= 3 ? explicitItems : (Array.isArray(suggestion.items) ? suggestion.items : []);
  if (!items.length) return { intent: 'update_variable_budget', confidence: 'low', missingInfo: ['variablePlan'] };
  return { intent: 'update_variable_budget', confidence: 'high', proposedAction: { id: uid('buddy_action'), type: 'update_variable_plan', title: 'Använd ny rörlig plan', description: 'Ersätt den rörliga planen med det här förslaget. Inget ändras förrän du säger ja.', payload: { items: items.map((item: any) => ({ id: item.id, label: item.label, amount: Math.max(0, Math.round(Number(item.amount || 0))), category: item.category || 'Rörligt', include: item.include !== false })), availableAfterFixed: available, marginLeft: Number(suggestion.marginLeft ?? suggestion.buffer ?? Math.max(0, available - items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0))), mode: 'safe', notes: suggestion.note || 'Förslaget är beräknat deterministiskt av Klirr.' }, confirmLabel: 'Ja, använd planen', cancelLabel: 'Nej, behåll nuvarande', status: 'pending' } };
}

export function planBuddyAction(input: BuddyActionPlannerInput): BuddyActionPlan {
  const message = input.message || '';
  const incomes = input.incomes || input.context?.incomes || [];
  if (isTroubleshooting(message)) return { intent: 'troubleshooting', confidence: 'high', explanationHints: ['Användaren felsöker tidigare Budget Buddy-action.'] };
  if (extractGrossSalary(message) || isSalaryIntentWithoutAmount(message)) return makeIncomeAction(message, incomes, input.context);
  if (variableBudgetIntent(message) || extractVariablePlanItemsFromText(message).length >= 3 || (!input.pendingAction && variablePlanConfirmationIntent(message) && recentDiscussionWasVariablePlan(input))) return makeVariablePlanAction(input);
  return { intent: 'none', confidence: 'low' };
}
