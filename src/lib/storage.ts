import type { AppState } from '../types';
import { normalizeSubscription } from './entitlements';
import { ensureWorkspaceState } from './premiumWorkspace';
import { migrateOnboardingState } from './onboarding';

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
    return ensureWorkspaceState({ ...parsed, ...normalizeSubscription(parsed.subscriptionPlan, parsed.subscriptionStatus), onboarding, onboardingCompleted: onboarding.status === 'COMPLETED' });
  } catch { return null; }
}

export function clearState() {
  localStorage.removeItem(KEY);
}
