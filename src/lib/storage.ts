import type { AppState } from '../types';
import { normalizeSubscription } from './entitlements';
import { ensureWorkspaceState } from './premiumWorkspace';
import { migrateOnboardingState } from './onboarding';
import { normalizePrivacyState } from './privacy';

const KEY = 'klirr-webdemo-v0.7-state';

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function loadState(): AppState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppState;
    const onboarding = migrateOnboardingState({ onboarding: parsed.onboarding, onboardingCompleted: parsed.onboardingCompleted });
return normalizePrivacyState(ensureWorkspaceState({ ...parsed, ...normalizeSubscription(parsed.subscriptionPlan, parsed.subscriptionStatus), onboarding, onboardingCompleted: onboarding.status === 'COMPLETED' }));
  } catch { return null; }
}

export function clearState() {
  localStorage.removeItem(KEY);
}
