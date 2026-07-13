import type { AppState } from '../types';

export const PRIVACY_SCHEMA_VERSION = 'privacy-trust-v1';
export const AI_LOG_MAX_ENTRIES = 50;
export const LEGAL_PLACEHOLDER = 'Ej konfigurerat';

export const legalDocumentConfig = {
  organizationName: LEGAL_PLACEHOLDER,
  organizationNumber: LEGAL_PLACEHOLDER,
  address: LEGAL_PLACEHOLDER,
  privacyEmail: LEGAL_PLACEHOLDER,
  supportEmail: LEGAL_PLACEHOLDER,
  country: LEGAL_PLACEHOLDER,
  policyEffectiveDate: 'Ej fastställd',
  termsEffectiveDate: 'Ej fastställd',
  privacyPolicyVersion: 'utkast-0.1',
  termsVersion: 'utkast-0.1',
  aiInfoVersion: 'utkast-0.1',
} as const;

export function defaultPrivacyPreferences() {
  return { aiEnabled: false, optionalAnalyticsEnabled: false, marketingEnabled: false };
}

export function normalizePrivacyState(state: AppState): AppState {
  return {
    ...state,
    privacyPreferences: { ...defaultPrivacyPreferences(), ...(state.privacyPreferences || {}) },
    consentRecords: state.consentRecords || [],
    aiContextLog: pruneAiLog(state.aiContextLog || []),
  };
}

export function hasAcceptedConsent(state: AppState, type: string, version: string) {
  return [...(state.consentRecords || [])].reverse().some(r => r.type === type && r.documentVersion === version && r.status === 'accepted');
}

export function addConsentRecord(state: AppState, record: Omit<NonNullable<AppState['consentRecords']>[number], 'id' | 'decidedAt'>): AppState {
  const next = normalizePrivacyState(state);
  return { ...next, consentRecords: [...(next.consentRecords || []), { ...record, id: `consent_${Date.now()}_${Math.random().toString(16).slice(2)}`, decidedAt: new Date().toISOString() }] };
}

export function withdrawAiConsent(state: AppState): AppState {
  return addConsentRecord({ ...normalizePrivacyState(state), privacyPreferences: { ...normalizePrivacyState(state).privacyPreferences!, aiEnabled: false } }, { type: 'ai_features', documentVersion: legalDocumentConfig.aiInfoVersion, status: 'withdrawn', source: 'settings', locale: 'sv-SE' });
}

export function pruneAiLog(entries: NonNullable<AppState['aiContextLog']>) {
  const now = Date.now();
  const alive = entries.filter(e => !e.retentionExpiresAt || Date.parse(e.retentionExpiresAt) > now);
  const deduped = alive.filter((entry, index, arr) => index === 0 || JSON.stringify({ ...entry, id: '', createdAt: '' }) !== JSON.stringify({ ...arr[index - 1], id: '', createdAt: '' }));
  return deduped.slice(-AI_LOG_MAX_ENTRIES);
}

export function appendAiLog(state: AppState, entry: NonNullable<AppState['aiContextLog']>[number]): AppState {
  const next = normalizePrivacyState(state);
  return { ...next, aiContextLog: pruneAiLog([...(next.aiContextLog || []), entry]) };
}

export function buildDataExport(state: AppState) {
  const safe = normalizePrivacyState(state);
  const manifest = {
    generatedAt: new Date().toISOString(), schemaVersion: PRIVACY_SCHEMA_VERSION, appVersion: '1.0.2',
    includedCategories: ['profileAndSettings','privacyPreferences','consents','budget','accounts','transactions','rulesAndDecisions','budgetBuddy','archivedExperimentData','aiTransparencyLog'],
    workspaceCount: 1, transactionCount: safe.transactions.length, aiLogCount: safe.aiContextLog?.length || 0,
  };
  return { manifest, profileAndSettings: { onboarding: safe.onboarding, householdProfile: safe.householdProfile, subscriptionPlan: safe.subscriptionPlan, subscriptionStatus: safe.subscriptionStatus }, privacyPreferences: safe.privacyPreferences, consents: safe.consentRecords, activeWorkspaceId: 'local-demo-workspace', workspaces: [{ id: safe.activeWorkspaceId || 'local-demo-workspace', name: 'Lokal demo-Budget', simulatedSharedMembers: [] }], currentBudgetData: { incomes: safe.incomes, fixedExpenses: safe.manualExpenses.filter(e => e.costType === 'fixed'), variableExpenses: safe.variablePlan }, accounts: safe.accounts, transactions: safe.transactions, incomes: safe.incomes, fixedExpenses: safe.manualExpenses.filter(e => e.costType === 'fixed'), variableExpenses: safe.variablePlan, rulesAndDecisions: { rules: safe.rules, recurringDecisions: safe.recurringDecisions, transferDecisions: safe.transferDecisions, reviewDecisions: safe.reviewDecisions, scenarioOff: safe.scenarioOff }, budgetBuddyMessages: safe.chatMessages, budgetBuddyActionHistory: safe.buddyActionHistory || [], archivedExperimentData: { premiumGoals: safe.premiumGoals || [], reminders: [], metricSnapshots: safe.premiumSnapshots || [], versions: safe.premiumSnapshots || [], automaticReview: safe.premiumMonitoring || null, sharedMemberDemoData: [], premiumActivation: safe.premiumActivation || null }, aiTransparencyLog: safe.aiContextLog || [] };
}
