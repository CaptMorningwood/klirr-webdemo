import { describe, expect, it } from 'vitest';
import type { AppState } from '../../types';
import { prepareSafeAiContext, AI_CONTEXT_DENYLIST } from '../aiPrivacy';
import { addConsentRecord, appendAiLog, buildDataExport, defaultPrivacyPreferences, hasAcceptedConsent, legalDocumentConfig, pruneAiLog, withdrawAiConsent } from '../privacy';
import { activateBudgetBuddyAi, disableBudgetBuddyAi, getBudgetBuddyAiStatus, isBudgetBuddyAiActive } from '../budgetBuddyAiAccess';

const baseState: AppState = { accounts: [{ id: 'acc', name: 'Bank', isOwn: true }], transactions: [{ id: 'tx', accountId: 'acc', date: '2026-01-01', description: 'Hemlig butik', amount: -123, originalDescription: 'Original', counterparty: 'Person', bankReference: 'Ref', balanceAfter: 999, raw: { importedRows: ['x'] } }], rules: [], incomes: [{ id: 'i', label: 'Lön', amount: 30000, frequency: 'monthly' }], manualExpenses: [], variablePlan: [{ id: 'v', label: 'Mat', amount: 5000, category: 'Vardag', include: true }], recurringDecisions: {}, transferDecisions: {}, reviewDecisions: {}, scenarioOff: [], chatMessages: [], buddyActionHistory: [], onboardingCompleted: true, privacyPreferences: defaultPrivacyPreferences(), consentRecords: [], aiContextLog: [] };
const summary = { totalIncome: 30000, fixedTotal: 0, variablePlanTotal: 5000, totalMonthlyPlan: 5000, remainingAfterFixed: 30000, remainingAfterPlan: 25000, fixedItems: [], variableItems: [{ id: 'v', label: 'Mat', amount: 5000, category: 'Vardag', source: 'variablePlan' as const }], activeRecurring: [], incomeItems: [{ id: 'i', label: 'Lön', amount: 30000, category: 'Inkomst', source: 'manual' as const }], warnings: [] };
const detection = { transfers: [], recurring: [{ id: 'r', normName: 'secret', label: 'Secret merchant', category: 'X', costTypeDefault: 'fixed' as const, frequency: 'monthly' as const, occurrences: 1, monthlyAmount: 1, meanAmount: 1, minAmount: 1, maxAmount: 1, amountVaries: false, confidence: 1, lastDate: '2026-01-01', txIds: ['tx'], reason: 'x' }], reviewItems: [] };

describe('Privacy & Trust AI context', () => {
  it('blocks AI when disabled or consent withdrawn and does not delete budget data', () => {
    const blocked = prepareSafeAiContext({ state: baseState, summary, detection, userMessage: 'hej', requestType: 'chat', purpose: 'test', visibleReviewCount: 0, handledReviewCount: 0 });
    expect(blocked.allowed).toBe(false);
    const withdrawn = withdrawAiConsent({ ...baseState, privacyPreferences: { ...defaultPrivacyPreferences(), aiEnabled: true } });
    expect(withdrawn.incomes).toHaveLength(1);
    expect(prepareSafeAiContext({ state: withdrawn, summary, detection, userMessage: 'hej', requestType: 'chat', purpose: 'test', visibleReviewCount: 0, handledReviewCount: 0 }).allowed).toBe(false);
  });
  it('excludes raw transaction fields and includes safe summaries', () => {
    const consented = addConsentRecord({ ...baseState, privacyPreferences: { ...defaultPrivacyPreferences(), aiEnabled: true } }, { type: 'ai_features', documentVersion: legalDocumentConfig.aiInfoVersion, status: 'accepted', source: 'settings' });
    const result = prepareSafeAiContext({ state: consented, summary, detection, userMessage: 'hjälp', requestType: 'chat', purpose: 'test', visibleReviewCount: 0, handledReviewCount: 0 });
    expect(result.allowed).toBe(true);
    const serialized = JSON.stringify(result.allowed ? result.context : {});
    for (const field of AI_CONTEXT_DENYLIST) expect(serialized).not.toContain(`"${field}":`);
    expect(serialized).toContain('totalIncome');
    expect(result.logEntry.containsRawTransactions).toBe(false);
  });

  it('uses the same privacy boundary for Premium Buddy+ requests with workspace id', () => {
    const consented = addConsentRecord({ ...baseState, activeWorkspaceId: 'workspace_premium', privacyPreferences: { ...defaultPrivacyPreferences(), aiEnabled: true } }, { type: 'ai_features', documentVersion: legalDocumentConfig.aiInfoVersion, status: 'accepted', source: 'settings' });
    const result = prepareSafeAiContext({ state: consented, summary, detection, userMessage: 'Skapa min förbättringsplan', requestType: 'premium_buddy_plus', purpose: 'Premium Buddy+ fortsättning', workspaceId: 'workspace_premium', visibleReviewCount: 0, handledReviewCount: 0 });
    expect(result.allowed).toBe(true);
    expect(result.logEntry.requestType).toBe('premium_buddy_plus');
    expect(result.logEntry.workspaceId).toBe('workspace_premium');
    expect(JSON.stringify(result.allowed ? result.context : {})).not.toMatch(/originalDescription|counterparty|bankReference|balanceAfter|txIds/);
  });

  it('prunes AI transparency log and export includes raw owned transactions but no token field', () => {
    const entries = Array.from({ length: 55 }, (_, i) => ({ id: `ai_${i}`, createdAt: `2026-01-${String(i + 1).padStart(2, '0')}`, purpose: 'p', requestType: 'r', summaryFields: { i }, warningsIncluded: [], dataCategories: [], containsRawTransactions: false as const, destinationLabel: 'd', outcome: 'prepared' as const }));
    expect(pruneAiLog(entries)).toHaveLength(50);
    const exported = buildDataExport(appendAiLog(baseState, entries[0]));
    expect(exported.transactions[0].raw).toEqual({ importedRows: ['x'] });
    expect(JSON.stringify(exported)).not.toMatch(/access_token|apiKey|secret/i);
  });
});

describe('Budget Buddy AI access status', () => {
  it('derives status from preference plus latest versioned consent', () => {
    expect(getBudgetBuddyAiStatus(baseState)).toBe('disabled');
    const active = activateBudgetBuddyAi(baseState, 'home');
    expect(getBudgetBuddyAiStatus(active)).toBe('active');
    expect(isBudgetBuddyAiActive(active)).toBe(true);
    expect(getBudgetBuddyAiStatus(disableBudgetBuddyAi(active, 'privacy_settings'))).toBe('disabled');
    const legacy = addConsentRecord({ ...baseState, privacyPreferences: { ...defaultPrivacyPreferences(), aiEnabled: true } }, { type: 'ai_features', documentVersion: 'old-version', status: 'accepted', source: 'settings' });
    expect(getBudgetBuddyAiStatus(legacy)).toBe('consent_missing');
  });

  it('uses the latest matching consent record and activation is idempotent', () => {
    const accepted = addConsentRecord({ ...baseState, privacyPreferences: { ...defaultPrivacyPreferences(), aiEnabled: true } }, { type: 'ai_features', documentVersion: legalDocumentConfig.aiInfoVersion, status: 'accepted', source: 'settings' });
    const withdrawn = withdrawAiConsent(accepted);
    expect(hasAcceptedConsent(withdrawn, 'ai_features', legalDocumentConfig.aiInfoVersion)).toBe(false);
    expect(getBudgetBuddyAiStatus({ ...withdrawn, privacyPreferences: { ...withdrawn.privacyPreferences!, aiEnabled: true } })).toBe('consent_missing');
    const reactivated = activateBudgetBuddyAi(withdrawn, 'buddy');
    expect(hasAcceptedConsent(reactivated, 'ai_features', legalDocumentConfig.aiInfoVersion)).toBe(true);
    expect(getBudgetBuddyAiStatus(reactivated)).toBe('active');
    const count = reactivated.consentRecords?.length || 0;
    const repeated = activateBudgetBuddyAi(reactivated, 'buddy');
    expect(repeated.consentRecords).toHaveLength(count);
    expect(repeated.incomes).toEqual(baseState.incomes);
  });
});
