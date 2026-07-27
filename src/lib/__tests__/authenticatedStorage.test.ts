import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../../types';
import {
  adoptLegacyState,
  hasLegacyState,
  loadState,
  saveState,
} from '../storage';

describe('authenticated local storage', () => {
  const values = new Map<string, string>();
  const baseState: AppState = {
    accounts: [],
    transactions: [],
    rules: [],
    incomes: [],
    manualExpenses: [],
    variablePlan: [],
    recurringDecisions: {},
    transferDecisions: {},
    scenarioOff: [],
    chatMessages: [],
    onboardingCompleted: false,
  };

  beforeEach(() => {
    values.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  it('does not expose one authenticated user state to another', () => {
    saveState({ ...baseState, incomes: [{ id: 'private', label: 'Lön', amount: 42, frequency: 'monthly' }] }, 'user-a');
    expect(loadState('user-a')?.incomes[0]?.id).toBe('private');
    expect(loadState('user-b')).toBeNull();
  });

  it('quarantines legacy shared state until explicit adoption', () => {
    values.set('klirr-webdemo-v0.7-state', JSON.stringify(baseState));
    expect(hasLegacyState()).toBe(true);
    expect(loadState('user-a')).toBeNull();

    expect(adoptLegacyState('user-a')).not.toBeNull();
    expect(loadState('user-a')).not.toBeNull();
    expect(loadState('user-b')).toBeNull();
    expect(hasLegacyState()).toBe(false);
  });
});
