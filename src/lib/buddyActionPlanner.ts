import type { BuddyProposedAction, HouseholdProfile, Income, VariablePlanItem } from '../types';
import { uid } from './format';
import { estimateSwedishNetSalary } from './taxEstimate';
import { selectIncomeTargetForSalaryUpdate } from './incomeTargeting';
import { suggestVariableBudget } from './budgetSuggestionEngine';

export type BuddyActionPlanIntent = 'salary_estimate_update_income' | 'update_variable_budget' | 'create_rule' | 'move_recurring_item' | 'reject_recurring_item' | 'fix_duplicate_income' | 'create_scenario' | 'run_budget_checkup' | 'income_disambiguation_needed' | 'troubleshooting' | 'none';
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
  const directPlan = /(krisbudget|gör krisbudget|gor krisbudget|överlev månaden|overlev manaden|vi måste bara klara månaden|vi maste bara klara manaden|minimera allt|maxa marginal men inte svälta matbudgeten|maxa marginal men inte svalta matbudgeten|tightaste planen|akut budget|rörlig(?:a)? plan(?:en)?|ny(?:\s+rörlig)?\s+plan|lägg upp en plan|lagg upp en plan|gör en plan|gor en plan|ändra planen|andra planen|justera planen|använd planen|anvand planen|kör på planen|kor pa planen|fördela pengarna|fordela pengarna|planera det rörliga|vardagsbudget)/i.test(text);
  const changePlan = /(mer buffert|mer sparande|mindre mat|mer nöje|mer noje|lägg .* på nöje|lagg .* pa noje|lägg .* på buffert|lagg .* pa buffert|minska .*mat|dra ner .*mat)/i.test(text);
  const budgetPlan = /(tryggare|försiktig|forsiktig|tajtare).*(rörlig|plan|budget)|(?:rörlig|rörliga) budget|budgetförslag|budgetforslag|föreslå.*budget|foresla.*budget|gör budgeten|gor budgeten|använd trygg budget|anvand trygg budget/i.test(text);
  return directPlan || changePlan || budgetPlan;
}

function variablePlanConfirmationIntent(message: string) {
  return /^(\s*)(ja[,! ]*)?(gör så|gor sa|kör på det|kor pa det|kör på den|kor pa den|lägg in den|lagg in den|använd den(?: planen)?|anvand den(?: planen)?|det låter bra|det later bra|låter bra|later bra|så kör vi|sa kor vi)(\s*[!.]*)?$/i.test(message.toLowerCase());
}

const categoryAliases = [
  { label: 'Mat och hushåll', category: 'Mat', pattern: /mat(?:\s+och\s+hushåll)?|matvaror|livsmedel|matbudget/i },
  { label: 'Transport rörligt', category: 'Transport', pattern: /transport(?:\s+rörligt)?|buss|bil|resor/i },
  { label: 'Nöje', category: 'Nöje', pattern: /nöje|noje/i },
  { label: 'Övrigt hushåll', category: 'Övrigt', pattern: /övrigt(?:\s+hushåll)?|ovrigt(?:\s+hushall)?/i },
  { label: 'Buffert/sparande', category: 'Buffert', pattern: /buffert|sparande/i },
];


export const REQUIRED_VARIABLE_LABELS = ['Mat och hushåll', 'Transport rörligt', 'Nöje', 'Övrigt hushåll', 'Buffert/sparande'];

export function hasCompleteVariablePlan(items: Array<{ label: string }>) {
  const labels = new Set(items.map(item => item.label));
  return REQUIRED_VARIABLE_LABELS.every(label => labels.has(label));
}

export function mergeExplicitItemsWithSuggestion(explicitItems: Array<any>, suggestionItems: Array<any>) {
  if (!suggestionItems.length) return explicitItems;
  const explicitByLabel = new Map(explicitItems.map(item => [item.label, item]));
  return suggestionItems.map(base => {
    const explicit = explicitByLabel.get(base.label);
    return explicit ? { ...base, ...explicit, id: base.id || explicit.id, include: explicit.include !== false } : base;
  });
}

function crisisBudgetIntent(message: string) {
  return /(gör krisbudget|gor krisbudget|krisbudget|överlev månaden|overlev manaden|vi måste bara klara månaden|vi maste bara klara manaden|minimera allt|maxa marginal men inte svälta matbudgeten|maxa marginal men inte svalta matbudgeten|tightaste planen|akut budget)/i.test(message.toLowerCase());
}

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


function makeRuleAction(message: string): BuddyActionPlan | null {
  const match = message.match(/(.+?)\s+ska alltid vara\s+(.+)/i);
  if (!match) return null;
  const matchText = match[1].replace(/[“”"]/g, '').trim();
  const categoryText = match[2].trim();
  const category = /mat|livsmedel|matvaror/i.test(categoryText) ? 'Mat' : categoryText;
  return { intent: 'create_rule', confidence: 'high', proposedAction: { id: uid('buddy_action'), type: 'create_rule', title: 'Skapa regel', description: `Skapa en regel för “${matchText}”. Inget ändras förrän du säger ja.`, payload: { matchText, category, costType: 'variable', note: 'Skapad via Budget Buddy.' }, confirmLabel: 'Ja, skapa regeln', cancelLabel: 'Nej, hoppa över', status: 'pending', riskLevel: 'low', undoable: true } };
}

function findRecurringByText(context: any, message: string) {
  const recurring = Array.isArray(context?.recurring) ? context.recurring : [];
  const lower = message.toLowerCase();
  return recurring.find((item: any) => lower.includes(String(item.label || item.normName || '').toLowerCase())) || recurring[0];
}

function makeRecurringAction(message: string, context: any): BuddyActionPlan | null {
  const item = findRecurringByText(context, message);
  if (!item) return null;
  if (/(ska inte vara ett måste|ska inte vara ett maste|flytta .*rörlig|flytta .*rorlig)/i.test(message)) {
    return { intent: 'move_recurring_item', confidence: 'high', proposedAction: { id: uid('buddy_action'), type: 'move_recurring_item', title: 'Flytta post', description: `Flytta “${item.label}” från Måsten till rörlig plan. Kontoutdraget ändras inte.`, payload: { recurringId: item.id, label: item.label, from: 'fixed', to: 'variable', category: item.category }, confirmLabel: 'Ja, flytta posten', cancelLabel: 'Nej, låt den vara', status: 'pending', riskLevel: 'low', undoable: true } };
  }
  if (/(räkna bort|rakna bort|ta bort från budget|ta bort fran budget)/i.test(message)) {
    return { intent: 'reject_recurring_item', confidence: 'medium', proposedAction: { id: uid('buddy_action'), type: 'reject_recurring_item', title: 'Räkna bort post', description: `Räkna bort “${item.label}” i budgeten. Kontoutdraget ändras inte.`, payload: { recurringId: item.id, label: item.label }, confirmLabel: 'Ja, räkna bort', cancelLabel: 'Nej, behåll', status: 'pending', riskLevel: 'medium', undoable: true } };
  }
  return null;
}

function makeDuplicateIncomeAction(message: string, context: any): BuddyActionPlan | null {
  if (!/(importerade lönen|importerade lonen|dubbel.*lön|dubbel.*lon)/i.test(message)) return null;
  const duplicate = Array.isArray(context?.possibleIncomeDuplicates) ? context.possibleIncomeDuplicates[0] : null;
  const imported = duplicate?.imported || duplicate?.recurring || duplicate;
  if (!imported?.id) return null;
  return { intent: 'fix_duplicate_income', confidence: 'medium', proposedAction: { id: uid('buddy_action'), type: 'fix_duplicate_income', title: 'Möjlig dubbelräkning av lön', description: 'Räkna bort den importerade lönen i budgeten. Kontoutdraget ändras inte.', payload: { incomeId: imported.id, label: imported.label || 'Importerad lön', amount: imported.amount, reason: 'Möjlig dubblett mot manuell lön.' }, confirmLabel: 'Räkna bort importerad lön', cancelLabel: 'Behåll båda', status: 'pending', riskLevel: 'medium', undoable: true } };
}

function makeScenarioAction(message: string, context: any): BuddyActionPlan | null {
  if (!/(vad händer om|vad hander om|scenario).*(tar bort|utan)/i.test(message)) return null;
  const recurring = Array.isArray(context?.recurring) ? context.recurring : [];
  const car = recurring.find((item: any) => /bil|leasing|garage|parkering|försäkring|forsakring/i.test(String(item.label || item.category || '')));
  if (!car) return null;
  const currentMargin = Number(context?.summary?.remainingAfterPlan || 0);
  const scenarioMargin = currentMargin + Number(car.monthlyAmount || 0);
  return { intent: 'create_scenario', confidence: 'medium', proposedAction: { id: uid('buddy_action'), type: 'create_scenario', title: 'Scenario: utan bil', description: 'Visa hur marginalen påverkas om bilposten stängs av i scenario. Inget original ändras.', payload: { scenarioOffIds: [car.id], label: 'utan bil', currentMargin, scenarioMargin }, confirmLabel: 'Visa scenario', cancelLabel: 'Avbryt', status: 'pending', riskLevel: 'low', undoable: true } };
}

function makeCheckupAction(message: string, context: any): BuddyActionPlan | null {
  if (!/(städa min budget|stada min budget|budget checkup|kolla budget|gå igenom budget|ga igenom budget)/i.test(message)) return null;
  const issues: Array<{ label: string; severity: 'info' | 'warning' | 'danger'; nextAction?: string }> = [];
  if ((context?.possibleIncomeDuplicates || []).length) issues.push({ label: 'Möjlig dubbelräkning av lön', severity: 'warning', nextAction: 'Välj vilken lön som ska räknas.' });
  if (Number(context?.summary?.remainingAfterPlan || 0) < 0) issues.push({ label: 'Ingen marginal efter planen', severity: 'danger', nextAction: 'Minska rörlig plan eller granska Måsten.' });
  if (Number(context?.summary?.fixedTotal || 0) > Number(context?.summary?.totalIncome || 0) * 0.8) issues.push({ label: 'Måsten är över 80% av inkomsten', severity: 'warning', nextAction: 'Gå igenom fasta kostnader.' });
  if (Number(context?.unconfirmedRecurringCount || 0) > 0) issues.push({ label: 'Oklara återkommande poster finns kvar', severity: 'info', nextAction: 'Granska importerade poster.' });
  if (!issues.length) issues.push({ label: 'Inga akuta problem hittade', severity: 'info', nextAction: 'Fortsätt hålla koll på marginalen.' });
  return { intent: 'run_budget_checkup', confidence: 'high', proposedAction: { id: uid('buddy_action'), type: 'run_budget_checkup', title: `Jag hittade ${issues.length} saker att dubbelkolla`, description: 'Checklistan ändrar inget automatiskt — vi går igenom den steg för steg.', payload: { issues }, confirmLabel: 'Gå igenom med mig', cancelLabel: 'Inte nu', status: 'pending', riskLevel: 'low' } };
}

function makeVariablePlanAction(input: BuddyActionPlannerInput): BuddyActionPlan {
  const summary = input.context?.summary || {};
  const available = Number(summary.remainingAfterFixed ?? input.context?.remainingAfterFixed ?? 0);
  if (!Number.isFinite(available) || available <= 0) {
    return { intent: 'update_variable_budget', confidence: 'medium', clarificationQuestion: 'Jag behöver veta ungefär vad som finns kvar efter måsten innan jag föreslår en trygg rörlig budget 💡', missingInfo: ['remainingAfterFixed'] };
  }
  const crisis = crisisBudgetIntent(input.message);
  const explicitItems = extractVariablePlanItemsFromText(input.message);
  const suggestion = crisis ? suggestVariableBudget({ available, mode: 'crisis', householdProfile: input.householdProfile, currentVariablePlan: input.variablePlan }) : input.context?.budgetSuggestion || suggestVariableBudget({ available, mode: crisis ? 'crisis' : 'safe', householdProfile: input.householdProfile, currentVariablePlan: input.variablePlan });
  const suggestionItems = Array.isArray(suggestion.items) ? suggestion.items : [];
  const items = explicitItems.length ? (hasCompleteVariablePlan(explicitItems) ? explicitItems : mergeExplicitItemsWithSuggestion(explicitItems, suggestionItems)) : suggestionItems;
  if (!items.length) return { intent: 'update_variable_budget', confidence: 'low', missingInfo: ['variablePlan'] };
  return { intent: 'update_variable_budget', confidence: 'high', proposedAction: { id: uid('buddy_action'), type: 'update_variable_plan', title: crisis ? 'Använd tillfällig krisbudget' : 'Använd ny rörlig plan', description: crisis ? 'Det här är en tillfällig, stram plan. Inget ändras förrän du säger ja.' : 'Ersätt den rörliga planen med det här förslaget. Inget ändras förrän du säger ja.', payload: { items: items.map((item: any) => ({ id: item.id, label: item.label, amount: Math.max(0, Math.round(Number(item.amount || 0))), category: item.category || 'Rörligt', include: item.include !== false })), availableAfterFixed: available, marginLeft: Number(suggestion.marginLeft ?? suggestion.buffer ?? Math.max(0, available - items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0))), mode: crisis ? 'crisis' : 'safe', notes: suggestion.note || 'Förslaget är beräknat deterministiskt av Klirr.' }, confirmLabel: 'Ja, använd planen', cancelLabel: 'Nej, behåll nuvarande', status: 'pending', riskLevel: 'medium', undoable: true } };
}

export function planBuddyAction(input: BuddyActionPlannerInput): BuddyActionPlan {
  const message = input.message || '';
  const incomes = input.incomes || input.context?.incomes || [];
  if (isTroubleshooting(message)) return { intent: 'troubleshooting', confidence: 'high', explanationHints: ['Användaren felsöker tidigare Budget Buddy-action.'] };
  if (extractGrossSalary(message) || isSalaryIntentWithoutAmount(message)) return makeIncomeAction(message, incomes, input.context);
  const localAction = makeRuleAction(message) || makeDuplicateIncomeAction(message, input.context) || makeRecurringAction(message, input.context) || makeScenarioAction(message, input.context) || makeCheckupAction(message, input.context);
  if (localAction) return localAction;
  if (variableBudgetIntent(message) || extractVariablePlanItemsFromText(message).length >= 3 || (!input.pendingAction && variablePlanConfirmationIntent(message) && recentDiscussionWasVariablePlan(input))) return makeVariablePlanAction(input);
  return { intent: 'none', confidence: 'low' };
}
