import type { AppState } from '../types';

const KEY = 'klirr-webdemo-v0.7-state';

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function loadState(): AppState | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as AppState; } catch { return null; }
}

export function clearState() {
  localStorage.removeItem(KEY);
}
