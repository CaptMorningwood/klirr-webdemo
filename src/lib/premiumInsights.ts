import type { AppState } from '../types';
import type { calculateBudget } from './budgetCalculator';

export interface PremiumInsight { key: string; title: string; explanation: string; priority: 'low' | 'medium' | 'high'; action: string }

export function buildProactiveInsights(state: Pick<AppState, 'dismissedInsightKeys' | 'budgetMetricSnapshots' | 'budgetGoals' | 'reminders' | 'automaticReview'>, summary: ReturnType<typeof calculateBudget>, budgetHealthScore: number, duplicateIncomeWarnings = 0): PremiumInsight[] {
  const insights: PremiumInsight[] = [];
  const fixedShare = summary.totalIncome > 0 ? summary.fixedTotal / summary.totalIncome : 0;
  if (fixedShare > 0.65) insights.push({ key: `fixed-share-${Math.round(fixedShare * 100)}`, title: 'Fasta utgifter tar stor plats', explanation: 'Det kan vara värt att se över bindande kostnader först.', priority: 'high', action: 'Öppna fasta utgifter' });
  if (summary.remainingAfterPlan < Math.max(1000, summary.totalIncome * 0.05)) insights.push({ key: `thin-margin-${Math.round(summary.remainingAfterPlan / 500)}`, title: 'Marginalen är tunn', explanation: 'En liten marginal gör Budgeten känslig för förändringar.', priority: 'high', action: 'Justera rörliga utgifter' });
  if (duplicateIncomeWarnings > 0) insights.push({ key: `dup-income-${duplicateIncomeWarnings}`, title: 'Möjlig dubbel inkomst', explanation: 'Kontrollera inkomsten så att Budgeten inte blir för optimistisk.', priority: 'medium', action: 'Granska inkomster' });
  const last = state.budgetMetricSnapshots?.[0];
  if (last && Math.abs(last.budgetHealthScore - budgetHealthScore) >= 10) insights.push({ key: `health-change-${last.budgetHealthScore}-${budgetHealthScore}`, title: 'Budgethälsan har ändrats', explanation: 'Jämför nuläget med senaste sparade Budgetutveckling.', priority: 'medium', action: 'Öppna Budgetutveckling' });
  const dismissed = new Set(state.dismissedInsightKeys || []);
  return insights.filter(i => !dismissed.has(i.key)).slice(0, 4);
}
