function uid(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function kr(n) { return `${Math.round(Number(n || 0)).toLocaleString('sv-SE')} kr`; }
function asArray(v) { return Array.isArray(v) ? v : []; }
function totals(ctx) { return ctx?.totals || ctx?.summary || {}; }
function lineItems(ctx, kind) { return asArray(ctx?.safeLines?.[kind] || ctx?.[kind] || []); }
function noChange(text) { return /(ändra inget|andra inget|bara resonera|visa bara|uppdatera inte|applicera inte|vill inte applicera)/i.test(String(text || '')); }
function parseAmount(text) { const m = String(text || '').match(/(\d[\d\s]{2,})(?:\s*kr)?/); return m ? Number(m[1].replace(/\s/g, '')) : null; }
function foodAction(message, ctx) {
  if (noChange(message)) return null;
  if (!/(sänk|sank|ändra|andra|sätt|satt).*(mat|livsmedel|matbudget)|mat.*(?:till|på|pa)\s*\d/i.test(message)) return null;
  const amount = parseAmount(message); if (!amount) return { missingInformation: ['amount'], message: 'Vilket belopp ska matbudgeten sättas till?' };
  const current = lineItems(ctx, 'variableItems').find(i => /mat|livsmedel/i.test(String(i.label || i.category || '')));
  const items = lineItems(ctx, 'variableItems').map(i => /mat|livsmedel/i.test(String(i.label || i.category || '')) ? { ...i, amount } : i);
  if (!items.length) items.push({ id: 'vp_food_buddy', label: 'Mat och hushåll', amount, category: 'Mat', include: true });
  const fixedLeft = Number(totals(ctx).remainingAfterFixed ?? totals(ctx).remainingAfterFixedTotal ?? 0);
  const marginLeft = fixedLeft - items.reduce((s, i) => s + Number(i.amount || 0), 0);
  return { proposedAction: { id: uid('buddy_action'), type: 'update_variable_plan', title: 'Ändra matbudgeten', description: `Sätt Mat och hushåll till ${kr(amount)}. Inget ändras förrän du bekräftar.`, payload: { items: items.map(i => ({ id: i.id, label: i.label || 'Rörlig post', amount: Number(i.amount || 0), category: i.category || 'Rörligt', include: i.include !== false })), availableAfterFixed: fixedLeft, marginLeft, mode: 'balanced', notes: 'Förberett deterministiskt av Budget Buddy.' }, confirmLabel: 'Ja, använd förslaget', cancelLabel: 'Nej, ändra inget', status: 'pending', riskLevel: 'medium', undoable: true }, before: current ? { label: current.label, amount: current.amount } : null, after: { label: 'Mat och hushåll', amount } };
}
function crisisAction(message, ctx) {
  if (noChange(message) || !/(gör|gor|skapa|förbered|forbered).*(krisbudget)|krisbudget/i.test(message)) return null;
  const fixedLeft = Number(totals(ctx).remainingAfterFixed || 0);
  const food = Math.max(2500, Math.min(5000, Math.floor(fixedLeft * 0.45 / 100) * 100));
  const items = [{ id: 'vp_crisis_food', label: 'Mat och hushåll', amount: food, category: 'Mat', include: true }, { id: 'vp_crisis_transport', label: 'Transport rörligt', amount: Math.min(900, Math.max(0, Math.floor(fixedLeft * 0.08 / 100) * 100)), category: 'Transport', include: true }, { id: 'vp_crisis_fun', label: 'Nöje', amount: 0, category: 'Nöje', include: true }, { id: 'vp_crisis_other', label: 'Övrigt hushåll', amount: Math.min(800, Math.max(0, Math.floor(fixedLeft * 0.08 / 100) * 100)), category: 'Övrigt', include: true }, { id: 'vp_crisis_buffer', label: 'Buffert/sparande', amount: 0, category: 'Buffert', include: true }];
  const marginLeft = fixedLeft - items.reduce((s, i) => s + i.amount, 0);
  return { proposedAction: { id: uid('buddy_action'), type: 'update_variable_plan', title: 'Använd tillfällig krisbudget', description: 'En tillfällig stram plan. Inget ändras förrän du bekräftar.', payload: { items, availableAfterFixed: fixedLeft, marginLeft, mode: 'crisis', notes: 'Krisbudget skyddar mat och nödvändiga vardagskostnader först.' }, confirmLabel: 'Ja, använd krisbudgeten', cancelLabel: 'Nej, behåll nuvarande', status: 'pending', riskLevel: 'medium', undoable: true } };
}
function executeTool(name, args, ctx) {
  const t = totals(ctx);
  switch (name) {
    case 'get_budget_overview': return { totalIncome: t.totalIncome, fixedTotal: t.fixedExpensesTotal ?? t.fixedTotal, variableTotal: t.variableExpensesTotal ?? t.variablePlanTotal, margin: t.margin ?? t.remainingAfterPlan, remainingAfterFixed: t.remainingAfterFixed, itemCounts: { income: lineItems(ctx, 'incomeItems').length, fixed: lineItems(ctx, 'fixedItems').length, variable: lineItems(ctx, 'variableItems').length } };
    case 'get_budget_health': return ctx.budgetHealth || { score: null, label: 'okänt', positiveReasons: [], negativeReasons: [], nextSteps: [] };
    case 'get_margin_details': { const margin = Number(t.margin ?? t.remainingAfterPlan ?? 0); const income = Number(t.totalIncome || 0); return { margin, marginRatio: income ? margin / income : null, primaryDrivers: lineItems(ctx, 'fixedItems').concat(lineItems(ctx, 'variableItems')).sort((a,b)=>Number(b.amount||0)-Number(a.amount||0)).slice(0,5).map(i=>({label:i.label, category:i.category, amount:i.amount})), riskLabel: margin < 0 ? 'negativ' : margin < income * 0.05 ? 'låg' : 'stabil' }; }
    case 'get_income_summary': return { total: t.totalIncome, incomeSources: lineItems(ctx, 'incomeItems').map(i => ({ label: i.label, amount: i.amount, frequency: i.frequency || 'monthly' })), warnings: ctx?.warnings?.income || [] };
    case 'get_fixed_expense_summary': return { total: t.fixedExpensesTotal ?? t.fixedTotal, items: lineItems(ctx, 'fixedItems').map(i => ({ label: i.label, amount: i.amount, category: i.category })), fixedShare: Number(t.totalIncome) ? Number((t.fixedExpensesTotal ?? t.fixedTotal) || 0) / Number(t.totalIncome) : null };
    case 'get_variable_expense_summary': { const items = lineItems(ctx, 'variableItems'); return { total: t.variableExpensesTotal ?? t.variablePlanTotal, items: items.map(i => ({ label: i.label, amount: i.amount, category: i.category })), largestCategory: items.slice().sort((a,b)=>Number(b.amount||0)-Number(a.amount||0))[0] || null, hasBufferLine: items.some(i => /buffert|spar/i.test(String(i.label || i.category || ''))) }; }
    case 'get_category_details': { const q = String(args?.category || '').toLowerCase(); return { matches: lineItems(ctx, 'fixedItems').concat(lineItems(ctx, 'variableItems'), lineItems(ctx, 'incomeItems')).filter(i => String(`${i.label} ${i.category}`).toLowerCase().includes(q)).map(i => ({ label: i.label, amount: i.amount, category: i.category })) }; }
    case 'get_review_status': return { unresolvedReview: ctx?.counts?.unresolvedReview || 0, recurringCandidates: ctx?.counts?.recurringCandidates || 0, transfers: ctx?.counts?.transfers || 0 };
    case 'get_household_profile': return ctx.household || null;
    case 'get_budget_completion': return ctx.completion || { percentage: null, missingItems: [] };
    case 'get_buddy_capabilities': return { canDiscuss: ['Budget', 'inkomster', 'utgifter', 'marginal', 'buffert', 'skulder på allmän nivå', 'Klirr-hjälp'], canPrepareActions: ['rörlig Budget', 'krisbudget', 'inkomständring', 'scenario'], approvalBoundary: 'Inget ändras förrän användaren bekräftar i Klirr.', privacy: 'Budget Buddy hämtar bara relevanta sammanfattade Budgetdelar via verktyg. Råa transaktioner delas inte.' };
    case 'get_conversation_state': return ctx.conversationSummary || { topic: null, activeGoal: null, unresolvedClarification: null };
    case 'draft_variable_budget': return foodAction(args?.message || ctx.userMessage, ctx) || { missingInformation: ['clear_change_request'], message: 'Jag kan resonera utan actionkort tills användaren vill förbereda en ändring.' };
    case 'draft_crisis_budget': return crisisAction(args?.message || ctx.userMessage, ctx) || { missingInformation: ['explicit_crisis_request'], message: 'Ingen krisbudget förberedd.' };
    case 'draft_income_change': return { missingInformation: ['not_implemented_in_server_tool'], message: 'Inkomständring behöver tydlig nettolön eller bruttoantagande och valideras av Klirr innan actionkort.' };
    case 'draft_scenario': return { missingInformation: ['scenario_scope'], message: 'Beskriv vilket scenario som ska testas, t.ex. utan bil eller lägre matbudget.' };
    case 'run_budget_checkup': return { issues: asArray(ctx?.completion?.missingItems).map(label => ({ label: String(label), severity: 'info' })), summary: ctx.budgetHealth || null };
    case 'prepare_navigation_action': return { actions: [{ label: 'Öppna översikt', tab: 'dashboard' }] };
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
const noArgs = { type: 'object', properties: {}, required: [], additionalProperties: false };
function schema(name, description, parameters = noArgs) { return { type: 'function', name, description, parameters, strict: true }; }
const toolSchemas = [
  schema('get_budget_overview','Hämta totalsummerad Budgetöversikt utan råa transaktioner.'), schema('get_budget_health','Hämta deterministisk Budgethälsa.'), schema('get_margin_details','Hämta marginaldetaljer och drivare.'), schema('get_income_summary','Hämta sammanfattade inkomster.'), schema('get_fixed_expense_summary','Hämta sammanfattade fasta utgifter.'), schema('get_variable_expense_summary','Hämta sammanfattad rörlig Budget.'),
  schema('get_category_details','Hämta detaljer för en säker Budgetkategori eller rad.', { type:'object', properties:{ category:{ type:'string' } }, required:['category'], additionalProperties:false }), schema('get_review_status','Hämta granskningsstatus utan transaktionsrader.'), schema('get_household_profile','Hämta hushållsprofil när relevant.'), schema('get_budget_completion','Hämta Budgetens kompletteringsgrad.'), schema('get_buddy_capabilities','Hämta Budget Buddys capabilities och Privacy-gräns.'), schema('get_conversation_state','Hämta samtalets sammanfattade state.'),
  schema('draft_variable_budget','Förbered rörlig Budget-action endast vid explicit ändringsavsikt.', { type:'object', properties:{ message:{ type:'string' } }, required:['message'], additionalProperties:false }), schema('draft_crisis_budget','Förbered krisbudget-action endast vid explicit begäran.', { type:'object', properties:{ message:{ type:'string' } }, required:['message'], additionalProperties:false }), schema('draft_income_change','Förbered inkomständring om tydligt begärt.', { type:'object', properties:{ message:{ type:'string' } }, required:['message'], additionalProperties:false }), schema('draft_scenario','Förbered scenario om tydligt begärt.', { type:'object', properties:{ message:{ type:'string' } }, required:['message'], additionalProperties:false }), schema('run_budget_checkup','Kör deterministisk Budget Checkup.'), schema('prepare_navigation_action','Förbered navigation i Klirr.', { type:'object', properties:{ destination:{ type:'string' } }, required:['destination'], additionalProperties:false })
];
const toolCategories = { get_budget_overview:['income totals','fixed total','variable total','margin'], get_budget_health:['budget health'], get_margin_details:['margin','primary drivers'], get_income_summary:['income summary'], get_fixed_expense_summary:['fixed expense summary'], get_variable_expense_summary:['variable Budget plan'], get_category_details:['category Budget data'], get_review_status:['review counts'], get_household_profile:['household profile'], get_budget_completion:['setup completion'], get_buddy_capabilities:[], get_conversation_state:['conversation state'], draft_variable_budget:['variable Budget plan'], draft_crisis_budget:['variable Budget plan','margin'], draft_income_change:['income summary'], draft_scenario:['scenario inputs'], run_budget_checkup:['budget health','setup completion'], prepare_navigation_action:[] };
export { toolSchemas, executeTool, toolCategories };
