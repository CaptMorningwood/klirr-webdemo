import type { AppState, BudgetSummary, DetectionResult } from '../types';
import { legalDocumentConfig, hasAcceptedConsent } from './privacy';
import { calculateBudgetCompletion } from './budgetCompletion';
import { calculateBudgetHealth } from './budgetHealth';

export const AI_CONTEXT_DENYLIST = ['transactions','raw','originalDescription','counterparty','bankReference','balanceAfter','txIds','importedRows','fileContent'];

export interface SafeAiContextInput { state: AppState; summary: BudgetSummary; detection: DetectionResult; userMessage: string; requestType: string; purpose: string; visibleReviewCount: number; handledReviewCount: number; workspaceId?: string; }

export function assertNoDeniedAiFields(value: unknown) {
  const text = JSON.stringify(value);
  for (const word of AI_CONTEXT_DENYLIST) {
    if (new RegExp(`"${word}"\\s*:`).test(text)) throw new Error(`AI context contains denied field: ${word}`);
  }
}

export function prepareSafeAiContext(input: SafeAiContextInput) {
  const prefs = input.state.privacyPreferences;
  const aiConsent = hasAcceptedConsent(input.state, 'ai_features', legalDocumentConfig.aiInfoVersion);
  const baseLog = { id: `ai_${Date.now()}_${Math.random().toString(16).slice(2)}`, createdAt: new Date().toISOString(), purpose: input.purpose, requestType: input.requestType, workspaceId: input.workspaceId || 'local-demo-workspace', summaryFields: {}, warningsIncluded: [], dataCategories: ['budget_summary'], containsRawTransactions: false as const, destinationLabel: '/api/budget-buddy', outcome: 'blocked' as const, failureReason: '' };
  if (!prefs?.aiEnabled) return { allowed: false as const, reason: 'AI-funktioner är avstängda. Budgeten fungerar ändå manuellt.', logEntry: { ...baseLog, failureReason: 'ai_disabled' } };
  if (!aiConsent) return { allowed: false as const, reason: 'AI kräver separat samtycke innan en förfrågan skickas.', logEntry: { ...baseLog, failureReason: 'ai_consent_missing_or_withdrawn' } };
  const completion = calculateBudgetCompletion({ state: input.state, summary: input.summary, detection: input.detection, visibleReviewCount: input.visibleReviewCount, handledReviewCount: input.handledReviewCount });
  const health = calculateBudgetHealth({ summary: input.summary, detection: input.detection, state: input.state, visibleReviewCount: input.visibleReviewCount, handledReviewCount: input.handledReviewCount });
  const context = { userMessage: input.userMessage, totals: { totalIncome: input.summary.totalIncome, fixedExpensesTotal: input.summary.fixedTotal, variableExpensesTotal: input.summary.variablePlanTotal, margin: input.summary.remainingAfterPlan }, budgetHealth: { score: health.score, label: health.label, reasons: health.reasons.map(r => r.label) }, completion: { percentage: completion.percentage, missingItems: completion.missingItems.map(i => i.label) }, counts: { accounts: input.state.accounts.length, importedTransactions: input.state.transactions.length, unresolvedReview: input.visibleReviewCount, handledReview: input.handledReviewCount, recurringCandidates: input.detection.recurring.length, transfers: input.detection.transfers.length }, household: input.state.householdProfile ? { adults: input.state.householdProfile.adults, children: input.state.householdProfile.children, teens: input.state.householdProfile.teens, pets: input.state.householdProfile.pets || 0 } : null, safeLabels: { incomeLabels: input.summary.incomeItems.map(i => i.source === 'manual' ? i.label : 'Importerad återkommande inkomst'), fixedCategories: [...new Set(input.summary.fixedItems.map(i => i.category))], variableCategories: [...new Set(input.summary.variableItems.map(i => i.category))] } };
  assertNoDeniedAiFields(context);
  return { allowed: true as const, context, logEntry: { ...baseLog, outcome: 'prepared' as const, summaryFields: context.totals, warningsIncluded: input.summary.warnings, dataCategories: ['budget_summary','budget_health','budget_completion','counts','household','safe_labels'] } };
}
