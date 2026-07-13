import type { BuddyAction, BudgetSummary, ChatMessage, DetectionResult, Rule } from '../types';
import { fmt, fmtSigned, todayIso, uid } from './format';
import { getActionableRecurringCandidates } from './recurrenceEngine';

export interface BuddyContext {
  summary: BudgetSummary;
  detection: DetectionResult;
  rules: Rule[];
  transactionCount?: number;
  recurringCandidateCount?: number;
  actionableIncomeCandidateCount?: number;
  actionableExpenseCandidateCount?: number;
  confirmedRecurringCount?: number;
  unconfirmedRecurringCount?: number;
  supportedBankFormats?: string[];
  possibleEncodingIssue?: boolean;
  recurringCandidateCountsByType?: Record<string, number>;
  knowledgeBaseCategories?: string[];
  transferCandidateCount?: number;
  onboardingStatus?: string;
  onboardingPath?: string;
  budgetCompletionPercentage?: number;
  missingSetupItems?: string[];
}

export function initialBuddyMessage(): ChatMessage {
  return {
    id: uid('msg'),
    role: 'assistant',
    createdAt: todayIso(),
    content: 'Hej! Jag är Budget Buddy. Jag finns för att skydda och förbättra din Budget 💚 Jag hjälper dig förstå vad livet kostar varje månad just nu, hitta fasta utgifter och bygga marginal. Fråga mig till exempel: ”Vad ska jag göra först?” eller ”Vad kan göra Budgeten mer hållbar?”',
  };
}

function topDrivers(summary: BudgetSummary) {
  return [...summary.fixedItems, ...summary.variableItems].sort((a, b) => b.amount - a.amount).slice(0, 5);
}

export function makeBuddyReply(question: string, ctx: BuddyContext): ChatMessage {
  const q = question.toLowerCase();
  const s = ctx.summary;
  const drivers = topDrivers(s);
  const actionable = getActionableRecurringCandidates(ctx.detection.recurring);
  const incomeCandidates = ctx.actionableIncomeCandidateCount ?? actionable.filter(r => r.costTypeDefault === 'income').length;
  const expenseCandidates = ctx.actionableExpenseCandidateCount ?? actionable.filter(r => r.costTypeDefault !== 'income').length;
  const unconfirmedCandidates = ctx.unconfirmedRecurringCount ?? actionable.length;
  let content = '';
  const actions: BuddyAction[] = [];

  if (q.includes('först') || q.includes('börja') || q.includes('nästa')) {
    content = `Jag skulle börja i den här ordningen:\n\n1. Granska oklara poster (${ctx.detection.reviewItems.length} st) så kalkylen blir rätt.\n2. Kontrollera fasta utgifter: ${fmt(s.fixedTotal)}.\n3. Titta på din marginal efter hela planen: ${fmtSigned(s.remainingAfterPlan)}.\n\nOm marginalen är låg är det mest värdefullt att justera Rörliga utgifter eller testa scenario på en större kostnad, inte fastna i småköp direkt.`;
    actions.push({ label: 'Gå till Import & granskning', tab: 'importReview' }, { label: 'Visa Plan', tab: 'plan' }, { label: 'Testa scenario', tab: 'scenarios' });
  } else if (q.includes('förklara') || q.includes('ekonomi') || q.includes('sammanfatta')) {
    content = `Så här ser din Budget ut just nu:\n\n• Inkomster: ${fmt(s.totalIncome)}\n• Fasta utgifter: ${fmt(s.fixedTotal)}\n• Kvar efter fasta utgifter: ${fmtSigned(s.remainingAfterFixed)}\n• Rörliga utgifter: ${fmt(s.variablePlanTotal)}\n• Kvar efter total plan: ${fmtSigned(s.remainingAfterPlan)}\n\nDe största posterna är:\n${drivers.map((d, i) => `${i + 1}. ${d.label}: ${fmt(d.amount)}`).join('\n')}`;
    actions.push({ label: 'Öppna översikt', tab: 'dashboard' }, { label: 'Öppna Plan', tab: 'plan' });
  } else if (q.includes('kapa') || q.includes('spara') || q.includes('minska') || q.includes('förbättra')) {
    const variable = [...s.variableItems].sort((a, b) => b.amount - a.amount).slice(0, 4);
    content = `Tre rimliga förbättringsspår:\n\n1. Justera Rörliga utgifter. Det är snabbast och påverkar direkt. Rörliga utgifter är nu ${fmt(s.variablePlanTotal)}.\n2. Testa scenario på större valfria poster. Små abonnemang kan hjälpa, men en större kostnad gör mer skillnad.\n3. Bekräfta oklara poster så du inte budgeterar för engångar.\n\nStörsta rörliga/justerbara posterna just nu:\n${variable.map((v) => `• ${v.label}: ${fmt(v.amount)}`).join('\n') || 'Jag hittar inga rörliga poster än.'}`;
    actions.push({ label: 'Gå till Plan', tab: 'plan' }, { label: 'Bygg scenario', tab: 'scenarios' });
  } else if (q.includes('vilka typer') || q.includes('letar klirr') || q.includes('måste') || q.includes('måsten') || q.includes('matköp') || q.includes('avanza') || q.includes('inte en utgift')) {
    content = `Klirr letar efter vanliga fasta utgifter som boende, el/värme/vatten, försäkringar, lån/skulder, bredband, mobil, fack/a-kassa, gym, barn/familj och abonnemang. Matköp, fika, restaurang, apotek, drivmedel och parkering räknas oftast som rörliga köp i stället för återkommande fasta utgifter 💡\n\nAvanza, Nordnet, ISK, sparkonto, top-up och överföringar mellan egna konton behandlas normalt som sparande/interna överföringar, inte konsumtionsutgifter. Refunds/returer räknas inte som normal inkomst.`;
    actions.push({ label: 'Granska återkommande', tab: 'recurring' }, { label: 'Visa överföringar', tab: 'transfers' });
  } else if (q.includes('oklar') || q.includes('otydlig') || q.includes('granska')) {
    content = ctx.detection.reviewItems.length
      ? `Jag hittar ${ctx.detection.reviewItems.length} oklara poster. De vanligaste orsakerna är möjliga engångskostnader, dubletter, plusposter eller låg säkerhet i återkommande-detektionen. Börja med de största beloppen först.`
      : 'Just nu finns inga oklara poster. Snyggt! Då är nästa steg att bekräfta återkommande utgifter och justera Rörliga utgifter.';
    actions.push({ label: 'Gå till Import & granskning', tab: 'importReview' });
  } else if (q.includes('kris') || q.includes('stram')) {
    const removable = s.variableItems.filter(x => x.source === 'variablePlan').map(x => x.id);
    content = `Krisläge betyder att vi bara räknar fasta utgifter och kapar Rörliga utgifter tillfälligt.\n\nMed dagens siffror:\n• Fasta utgifter: ${fmt(s.fixedTotal)}\n• Kvar efter fasta utgifter: ${fmtSigned(s.remainingAfterFixed)}\n\nDet är inte ett långsiktigt liv, men det visar miniminivån för att skydda Budgeten.`;
    actions.push({ label: 'Testa kris-scenario', tab: 'scenarios', scenarioOffIds: removable });
  } else if (q.includes('import') || q.includes('kontoutdrag') || q.includes('csv') || q.includes('syns inte') || q.includes('räknas inte') || q.includes('händer inget')) {
    if ((ctx.transactionCount || ctx.detection.recurring.length) && unconfirmedCandidates > 0) {
      content = `Jag ser att transaktionerna är importerade, men ${unconfirmedCandidates} möjliga inkomster/fasta utgifter är inte bekräftade än 💡\n\nKlirr hittade ${incomeCandidates} möjliga inkomster och ${expenseCandidates} möjliga fasta utgifter/återkommande utgifter. De räknas inte automatiskt in i Översikt eller Fasta utgifter förrän du bekräftar dem, så budgeten fortsätter vara framåtblickande.\n\nGå till Import & granskning → Återkommande och bekräfta lön, hyra, el, Telia eller andra poster som ska gälla framåt.`;
      actions.push({ label: 'Granska återkommande', tab: 'recurring' }, { label: 'Visa oklara poster', tab: 'review' });
    } else {
      content = 'Ladda upp kontoutdrag under Importera. När du har importerat flera konton ska du markera vilka som är dina egna. Då kan Klirr räkna överföringar mellan dina egna konton som interna, inte som inkomst eller utgift.';
      actions.push({ label: 'Gå till import', tab: 'import' }, { label: 'Visa konton', tab: 'accounts' }, { label: 'Visa interna överföringar', tab: 'transfers' });
    }
  } else if (q.includes('regel') || q.includes('kategori')) {
    content = 'Regler är Klirrs sätt att komma ihåg dina beslut. Om du säger “Telia = streaming” eller “Matboden = mat” ska den regeln gå före automatisk gissning nästa gång.';
    actions.push({ label: 'Gå till regler', tab: 'rules' });
  } else {
    content = `Jag kan hjälpa dig förstå din Budget, hitta fasta utgifter att justera, granska oklara poster och visa var i Klirr du ska gå.\n\nJag kan också hjälpa dig hitta rätt i appen: Översikt, Plan, Import & granskning, Hushåll, Budget Buddy eller Mer.

Just nu kostar din Budget ${fmt(s.totalMonthlyPlan)} och marginalen efter planen är ${fmtSigned(s.remainingAfterPlan)}. Vad vill du titta på först?`;
    actions.push({ label: 'Vad ska jag göra först?', message: 'Vad ska jag göra först?' }, { label: 'Förklara min Budget', message: 'Förklara min Budget' });
  }

  return { id: uid('msg'), role: 'assistant', content, actions, createdAt: todayIso() };
}

export type BuddySuggestionGroup = 'Förstå' | 'Förbättra' | 'Ändra' | 'Import och koll';

export type BuddySuggestion = {
  group: BuddySuggestionGroup;
  label: string;
  description?: string;
  message?: string;
};

export const buddySuggestionItems: BuddySuggestion[] = [
  { group: 'Förstå', label: 'Förklara min Budget', description: 'Se inkomster, fasta utgifter, rörliga utgifter och marginal.' },
  { group: 'Förstå', label: 'Förklara min Budgethälsa', description: 'Förstå scoret och vad som påverkar det.' },
  { group: 'Förstå', label: 'Förklara min marginal', description: 'Se vad som finns kvar efter planen.' },
  { group: 'Förstå', label: 'Förklara min Budgetutveckling', description: 'Sammanfatta förändringar när data finns.' },
  { group: 'Förbättra', label: 'Skapa min förbättringsplan', description: 'Få prioriterade steg för en starkare Budget.' },
  { group: 'Förbättra', label: 'Visa tre alternativa planer', description: 'Jämför lugn, balanserad och stram plan.' },
  { group: 'Förbättra', label: 'Hjälp mig nå mitt viktigaste mål', description: 'Koppla råden till målet som betyder mest.' },
  { group: 'Förbättra', label: 'Prioritera mina nästa steg', description: 'Välj vad som är mest värt att göra först.' },
  { group: 'Ändra', label: 'Hjälp mig justera inkomsten', description: 'Planera inkomständring med bekräftelse.' },
  { group: 'Ändra', label: 'Föreslå rörliga utgifter', description: 'Bygg eller justera vardagsbudgeten.' },
  { group: 'Ändra', label: 'Skapa en krisbudget', description: 'Gör ett tillfälligt stramt förslag.' },
  { group: 'Ändra', label: 'Förbered ett scenario', description: 'Testa hur Budgeten påverkas utan att ändra direkt.' },
  { group: 'Import och koll', label: 'Städa efter import', description: 'Hitta poster som behöver granskas.' },
  { group: 'Import och koll', label: 'Kör Budget Checkup', description: 'Kontrollera luckor och nästa steg.' },
  { group: 'Import och koll', label: 'Prioritera vad Klirr ska hålla koll på', description: 'Välj uppföljning som hjälper Budgeten mest.' },
];

export const buddySuggestions = buddySuggestionItems.map(item => item.label);
