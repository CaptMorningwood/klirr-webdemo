import type { AppState } from '../types';
import { normalizeSubscription } from './entitlements';
import { ensureWorkspaceState } from './premiumWorkspace';
import { migrateOnboardingState } from './onboarding';
import { normalizePrivacyState } from './privacy';

const LEGACY_KEY = 'klirr-webdemo-v0.7-state';
const KEY_PREFIX = 'klirr-webdemo-v1-user:';

function keyFor(appUserId: string) {
  if (!appUserId) throw new Error('A stable Klirr user ID is required for local storage.');
  return `${KEY_PREFIX}${appUserId}`;
}

function parseState(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppState;
    const onboarding = migrateOnboardingState({ onboarding: parsed.onboarding, onboardingCompleted: parsed.onboardingCompleted });
    return normalizePrivacyState(ensureWorkspaceState({ ...parsed, ...normalizeSubscription(parsed.subscriptionPlan, parsed.subscriptionStatus), onboarding, onboardingCompleted: onboarding.status === 'COMPLETED' }));
  } catch { return null; }
}

export function saveState(state: AppState, appUserId: string) {
  localStorage.setItem(keyFor(appUserId), JSON.stringify(state));
}

export function loadState(appUserId: string): AppState | null {
  return parseState(localStorage.getItem(keyFor(appUserId)));
}

export function clearState(appUserId: string) {
  localStorage.removeItem(keyFor(appUserId));
}

export function hasLegacyState() {
  return parseState(localStorage.getItem(LEGACY_KEY)) !== null;
}

export function adoptLegacyState(appUserId: string): AppState | null {
  const state = parseState(localStorage.getItem(LEGACY_KEY));
  if (!state) return null;
  localStorage.setItem(keyFor(appUserId), JSON.stringify(state));
  localStorage.removeItem(LEGACY_KEY);
  return state;
}
