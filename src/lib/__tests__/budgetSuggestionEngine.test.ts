import { describe, expect, it } from 'vitest';
import { suggestVariableBudget } from '../budgetSuggestionEngine';

function amount(result: ReturnType<typeof suggestVariableBudget>, label: string) {
  return result.items.find(item => item.label === label)?.amount ?? 0;
}

describe('budgetSuggestionEngine', () => {
  it('keeps safe mode as the largest safety part and boost as the largest fun part', () => {
    const householdProfile = { adults: 1, children: 0, teens: 0, pets: 0, foodAmbition: 'normal' as const, transportNeed: 'normal' as const };
    const safe = suggestVariableBudget({ available: 24000, mode: 'safe', householdProfile });
    const balanced = suggestVariableBudget({ available: 24000, mode: 'balanced', householdProfile });
    const boost = suggestVariableBudget({ available: 24000, mode: 'boost', householdProfile });

    expect(safe.safetyTotal).toBeGreaterThan(balanced.safetyTotal);
    expect(balanced.safetyTotal).toBeGreaterThan(boost.safetyTotal);
    expect(amount(safe, 'Nöje')).toBeLessThan(amount(balanced, 'Nöje'));
    expect(amount(balanced, 'Nöje')).toBeLessThan(amount(boost, 'Nöje'));
  });

  it('gives a larger household a higher food budget than one adult', () => {
    const single = suggestVariableBudget({ available: 30000, mode: 'balanced', householdProfile: { adults: 1, children: 0, teens: 0, foodAmbition: 'normal', transportNeed: 'normal' } });
    const family = suggestVariableBudget({ available: 30000, mode: 'balanced', householdProfile: { adults: 2, children: 3, teens: 0, foodAmbition: 'normal', transportNeed: 'normal' } });

    expect(amount(family, 'Mat och hushåll')).toBeGreaterThan(amount(single, 'Mat och hushåll'));
  });

  it('never exceeds available', () => {
    for (const mode of ['safe', 'balanced', 'boost'] as const) {
      const result = suggestVariableBudget({ available: 12345, mode, householdProfile: { adults: 2, children: 3, teens: 0, pets: 1, foodAmbition: 'comfortable', transportNeed: 'high' } });
      const planned = result.items.reduce((sum, item) => sum + item.amount, 0);
      expect(planned).toBeLessThanOrEqual(12345);
      expect(planned + result.marginLeft).toBeLessThanOrEqual(12345);
    }
  });

  it('returns zero budget when available is zero or negative', () => {
    const result = suggestVariableBudget({ available: -100, mode: 'balanced' });
    expect(result.marginLeft).toBe(0);
    expect(result.safetyTotal).toBe(0);
    expect(result.items.every(item => item.amount === 0)).toBe(true);
  });
});
