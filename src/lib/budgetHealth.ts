import type { AppState, BudgetSummary, DetectionResult } from '../types';

export interface BudgetHealthReason { id: string; label: string; impact: number; }
export interface BudgetHealthResult { score: number; label: string; reasons: BudgetHealthReason[]; }

function clampScore(score: number) { return Math.max(0, Math.min(100, Math.round(score))); }

export function budgetHealthLabel(score: number) {
  if (score >= 90) return 'Mycket stabil Budget';
  if (score >= 75) return 'Hälsosam Budget';
  if (score >= 60) return 'Budgeten behöver uppmärksamhet';
  if (score >= 40) return 'Sårbar Budget';
  return 'Instabil Budget';
}

export function calculateBudgetHealth(input: { summary: BudgetSummary; detection?: DetectionResult; state?: Partial<AppState>; possibleIncomeDuplicates?: unknown[]; visibleReviewCount?: number; handledReviewCount?: number; unconfirmedRecurringCount?: number; highSeverityIssueCount?: number }): BudgetHealthResult {
  const { summary } = input;
  const reasons: BudgetHealthReason[] = [];
  let score = 50;
  const add = (id: string, label: string, impact: number) => { score += impact; reasons.push({ id, label, impact }); };
  const income = summary.totalIncome || 0;
  const margin = summary.remainingAfterPlan || 0;
  const marginRatio = income > 0 ? margin / income : 0;

  if (income <= 0) add('income-missing', 'Budgeten saknar bekräftad inkomst.', -25);
  else add('income-present', 'Budgeten har bekräftad återkommande inkomst.', 8);

  if (margin < 0) add('negative-margin', 'Budgeten går minus efter plan.', -30);
  else if (marginRatio >= 0.15) add('strong-margin', 'Budgeten har stark marginal efter plan.', 22);
  else if (marginRatio >= 0.05) add('positive-margin', 'Budgeten har positiv marginal efter plan.', 14);
  else add('thin-margin', 'Budgeten saknar nästan marginal just nu.', -12);

  if (income > 0) {
    const fixedShare = summary.fixedTotal / income;
    if (fixedShare > 0.8) add('high-recurring-share', 'Återkommande kostnader tar mycket stor del av inkomsten.', -18);
    else if (fixedShare > 0.65) add('elevated-recurring-share', 'Återkommande kostnader tar stor del av inkomsten.', -10);
    else add('manageable-recurring-share', 'Återkommande kostnader lämnar utrymme i Budgeten.', 8);
  }

  const buffer = summary.variableItems.filter(item => /buffert|sparande/i.test(`${item.label} ${item.category}`)).reduce((sum, item) => sum + item.amount, 0);
  if (buffer > 0) add('buffer-present', 'Budgeten innehåller buffert eller sparande.', 8);
  else add('buffer-missing', 'Budgeten saknar buffert eller sparande.', -6);

  if (summary.remainingAfterFixed > 0 && summary.variablePlanTotal >= summary.remainingAfterFixed * 0.98) add('variable-consumes-space', 'Rörlig Budget använder nästan allt utrymme efter Måsten.', -10);

  const food = summary.variableItems.filter(item => /mat|hushåll|hushall|livsmedel/i.test(`${item.label} ${item.category}`)).reduce((sum, item) => sum + item.amount, 0);
  if (food > 0 && (food < 1500 || food > 18000)) add('food-outlier', 'Matbudgeten ser ovanligt låg eller hög ut.', -5);

  const duplicateCount = Array.isArray(input.possibleIncomeDuplicates) ? input.possibleIncomeDuplicates.length : 0;
  if (duplicateCount) add('duplicate-income', 'Möjlig dubbelräknad inkomst gör Budgeten mindre tillförlitlig.', -12);

  const unresolved = Math.max(0, Number(input.visibleReviewCount ?? input.detection?.reviewItems?.length ?? 0) - Number(input.handledReviewCount || 0));
  if (unresolved > 0) add('unresolved-review', 'Oklara poster behöver granskas innan Budgeten är helt tillförlitlig.', unresolved >= 8 ? -10 : -5);
  if (Number(input.unconfirmedRecurringCount || 0) > 0) add('unconfirmed-recurring', 'Obekräftade återkommande poster kan påverka Budgeten.', -6);
  if (!input.state?.householdProfile) add('household-missing', 'Hushållsprofil saknas, så Rörlig Budget blir mindre träffsäker.', -4);
  if (Number(input.highSeverityIssueCount || 0) > 0) add('critical-issues', 'Budget Checkup har kritiska saker att lösa.', -12);

  const finalScore = clampScore(score);
  return { score: finalScore, label: budgetHealthLabel(finalScore), reasons };
}

export function explainBudgetHealthChange(previous: BudgetHealthResult, next: BudgetHealthResult) {
  const delta = next.score - previous.score;
  if (delta === 0) return `Budgethälsan är fortfarande ${next.score}% — Budgetens stabilitet är oförändrad.`;
  const direction = delta > 0 ? 'steg' : 'sjönk';
  const reason = next.reasons.filter(r => delta > 0 ? r.impact > 0 : r.impact < 0).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))[0]?.label;
  return `Budgethälsan ${direction} från ${previous.score}% till ${next.score}%${reason ? ` eftersom ${reason.toLowerCase()}` : ''}.`;
}
