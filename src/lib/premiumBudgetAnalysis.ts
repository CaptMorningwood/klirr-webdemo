import type { AppState, BudgetGoal, Reminder } from '../types';
import type { calculateBudget } from './budgetCalculator';

export interface PremiumAnalysisItem { title: string; explanation: string; priority: 'low' | 'medium' | 'high'; action: string; destination?: string }
export interface PremiumBudgetAnalysis { strengths: PremiumAnalysisItem[]; risks: PremiumAnalysisItem[]; opportunities: PremiumAnalysisItem[]; nextSteps: PremiumAnalysisItem[] }

export function analyzePremiumBudget(summary: ReturnType<typeof calculateBudget>, budgetHealthScore: number, state: Pick<AppState, 'householdProfile' | 'budgetGoals' | 'reminders'>, unresolvedReviewCount = 0): PremiumBudgetAnalysis {
  const fixedShare = summary.totalIncome > 0 ? summary.fixedTotal / summary.totalIncome : 0;
  const marginShare = summary.totalIncome > 0 ? summary.remainingAfterPlan / summary.totalIncome : 0;
  const strengths: PremiumAnalysisItem[] = [];
  const risks: PremiumAnalysisItem[] = [];
  const opportunities: PremiumAnalysisItem[] = [];
  if (budgetHealthScore >= 70) strengths.push({ title: 'Budgethälsan är stabil', explanation: 'Budgeten har flera skyddande delar på plats.', priority: 'medium', action: 'Bevara marginalen' });
  if (summary.totalIncome > 0 && summary.fixedTotal > 0) strengths.push({ title: 'Fasta utgifter är synliga', explanation: 'Klirr kan visa vad livet kostar varje månad just nu.', priority: 'low', action: 'Granska återkommande poster' });
  if (fixedShare > 0.65) risks.push({ title: 'Hög andel fasta utgifter', explanation: 'Fasta utgifter tar mer än 65 % av inkomsten och gör Budgeten känsligare.', priority: 'high', action: 'Se över fasta utgifter', destination: 'musts' });
  if (marginShare < 0.05) risks.push({ title: 'Tunn marginal', explanation: 'Marginalen är låg i relation till inkomsten.', priority: 'high', action: 'Planera om rörliga utgifter', destination: 'variablePlan' });
  if (unresolvedReviewCount > 0) risks.push({ title: 'Oklara poster kvar', explanation: `${unresolvedReviewCount} poster behöver granskas innan Budgeten är helt tydlig.`, priority: 'medium', action: 'Granska poster', destination: 'review' });
  if ((state.budgetGoals || []).filter(g => g.status === 'active').length === 0) opportunities.push({ title: 'Sätt ett Budgetmål', explanation: 'Ett mål kan göra förbättringar konkreta utan att ändra Budgeten automatiskt.', priority: 'medium', action: 'Skapa Budgetmål' });
  if ((state.reminders || []).filter(r => r.status === 'active').length === 0) opportunities.push({ title: 'Lägg in en påminnelse', explanation: 'In-app-påminnelser hjälper dig hålla Budgeten aktuell.', priority: 'low', action: 'Skapa påminnelse' });
  const nextSteps = [...risks, ...opportunities].sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.priority] - { high: 3, medium: 2, low: 1 }[a.priority])).slice(0, 3);
  return { strengths, risks, opportunities, nextSteps };
}

export function goalProgress(goal: BudgetGoal, summary: ReturnType<typeof calculateBudget>, budgetHealthScore: number): { value: number; percent: number; completed: boolean } {
  const marginRatio = summary.totalIncome > 0 ? (summary.remainingAfterPlan / summary.totalIncome) * 100 : 0;
  const current = goal.type === 'budget_health' ? budgetHealthScore : goal.type === 'margin_amount' || goal.type === 'buffer_amount' ? summary.remainingAfterPlan : goal.type === 'margin_ratio' ? marginRatio : summary.fixedTotal;
  const completed = goal.type === 'reduce_fixed_expenses' ? current <= goal.targetValue : current >= goal.targetValue;
  const percent = goal.type === 'reduce_fixed_expenses' ? (goal.targetValue / Math.max(current, 1)) * 100 : (current / Math.max(goal.targetValue, 1)) * 100;
  return { value: current, percent: Math.max(0, Math.min(100, percent)), completed };
}

export function reminderBuckets(reminders: Reminder[], now = new Date().toISOString()) {
  const active = reminders.filter(r => r.status === 'active');
  return { overdue: active.filter(r => r.dueAt < now), upcoming: active.filter(r => r.dueAt >= now).sort((a, b) => a.dueAt.localeCompare(b.dueAt)) };
}
