import type { AppState, ConsentRecord } from '../types';
import { addConsentRecord, hasAcceptedConsent, legalDocumentConfig, normalizePrivacyState } from './privacy';

export type BudgetBuddyAiStatus = 'active' | 'disabled' | 'consent_missing';
export type BudgetBuddyAiActivationSource = 'home' | 'buddy' | 'privacy_settings';

function consentSource(_source: BudgetBuddyAiActivationSource): ConsentRecord['source'] {
  return 'settings';
}

export function getBudgetBuddyAiStatus(state: AppState): BudgetBuddyAiStatus {
  const normalized = normalizePrivacyState(state);
  if (!normalized.privacyPreferences?.aiEnabled) return 'disabled';
  return hasAcceptedConsent(normalized, 'ai_features', legalDocumentConfig.aiInfoVersion) ? 'active' : 'consent_missing';
}

export function isBudgetBuddyAiActive(state: AppState): boolean {
  return getBudgetBuddyAiStatus(state) === 'active';
}

export function activateBudgetBuddyAi(state: AppState, source: BudgetBuddyAiActivationSource): AppState {
  const normalized = normalizePrivacyState(state);
  const enabled = { ...normalized, privacyPreferences: { ...normalized.privacyPreferences!, aiEnabled: true } };
  if (hasAcceptedConsent(enabled, 'ai_features', legalDocumentConfig.aiInfoVersion)) return enabled;
  return addConsentRecord(enabled, {
    type: 'ai_features',
    documentVersion: legalDocumentConfig.aiInfoVersion,
    status: 'accepted',
    source: consentSource(source),
    locale: 'sv-SE',
  });
}

export function disableBudgetBuddyAi(state: AppState, _source: BudgetBuddyAiActivationSource): AppState {
  const normalized = normalizePrivacyState(state);
  return { ...normalized, privacyPreferences: { ...normalized.privacyPreferences!, aiEnabled: false } };
}
