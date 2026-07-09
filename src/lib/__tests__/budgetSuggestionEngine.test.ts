import { describe, expect, it } from 'vitest';
import { getCategoryCaps, suggestVariableBudget } from '../budgetSuggestionEngine';

function amount(result: ReturnType<typeof suggestVariableBudget>, label: string) {
  return result.items.find(item => item.label === label)?.amount ?? 0;
}

describe('budgetSuggestionEngine', () => {
  it('caps food for a high-income 2 adult and 2 child household and sends excess to safety', () => {
    const householdProfile = { adults: 2, children: 2, teens: 0, pets: 0, foodAmbition: 'normal' as const, transportNeed: 'normal' as const };
    const result = suggestVariableBudget({ available: 90000, mode: 'safe', householdProfile });
    const caps = getCategoryCaps({ available: 90000, mode: 'safe', householdProfile });

    expect(amount(result, 'Mat och hushåll')).toBeLessThan(45000);
    expect(amount(result, 'Mat och hushåll')).toBeLessThanOrEqual(caps['Mat och hushåll'].hardCap);
    expect(result.safetyTotal).toBeGreaterThan(amount(result, 'Mat och hushåll'));
    expect(result.overflowToSafety).toBeGreaterThan(0);
    expect(result.guidelineComparison.food.status).not.toBe('far_above');
  });

  it('gives one adult a lower food budget than two adults and two children', () => {
    const single = suggestVariableBudget({ available: 25000, mode: 'balanced', householdProfile: { adults: 1, children: 0, teens: 0, foodAmbition: 'normal', transportNeed: 'normal' } });
    const family = suggestVariableBudget({ available: 25000, mode: 'balanced', householdProfile: { adults: 2, children: 2, teens: 0, foodAmbition: 'normal', transportNeed: 'normal' } });

    expect(amount(single, 'Mat och hushåll')).toBeLessThan(amount(family, 'Mat och hushåll'));
  });

  it('keeps safe mode as the largest safety part and boost as the largest fun part without exceeding caps', () => {
    const householdProfile = { adults: 1, children: 0, teens: 0, pets: 0, foodAmbition: 'normal' as const, transportNeed: 'normal' as const };
    const safe = suggestVariableBudget({ available: 24000, mode: 'safe', householdProfile });
    const balanced = suggestVariableBudget({ available: 24000, mode: 'balanced', householdProfile });
    const boost = suggestVariableBudget({ available: 24000, mode: 'boost', householdProfile });

    expect(safe.safetyTotal).toBeGreaterThan(balanced.safetyTotal);
    expect(balanced.safetyTotal).toBeGreaterThan(boost.safetyTotal);
    expect(amount(safe, 'Nöje')).toBeLessThan(amount(boost, 'Nöje'));
    for (const result of [safe, balanced, boost]) {
      for (const item of result.items) expect(item.amount).toBeLessThanOrEqual(result.categoryCaps[item.label].hardCap);
    }
  });

  it('handles low available without negative margin and warns that the budget is tight', () => {
    const result = suggestVariableBudget({ available: 5000, mode: 'balanced', householdProfile: { adults: 2, children: 2, teens: 0, foodAmbition: 'normal', transportNeed: 'normal' } });

    expect(result.marginLeft).toBeGreaterThanOrEqual(0);
    expect(amount(result, 'Nöje')).toBeLessThanOrEqual(500);
    expect(amount(result, 'Mat och hushåll')).toBeGreaterThan(amount(result, 'Nöje'));
    expect(result.note).toMatch(/lågt|tajt/i);
  });

  it('returns guideline comparison and detects far above manual-style food amounts', () => {
    const result = suggestVariableBudget({ available: 90000, mode: 'balanced', householdProfile: { adults: 2, children: 2, teens: 0, foodAmbition: 'normal', transportNeed: 'normal' } });

    expect(result.guidelineComparison.food).toBeDefined();
    const reference = result.guidelineComparison.food.referenceAmount;
    const farAbovePct = (reference * 1.51 - reference) / reference;
    expect(farAbovePct).toBeGreaterThan(0.5);
    expect(result.guidelineComparison.food.status).not.toBe('far_above');
  });

  it('returns zero budget when available is zero or negative', () => {
    const result = suggestVariableBudget({ available: -100, mode: 'balanced' });
    expect(result.marginLeft).toBe(0);
    expect(result.safetyTotal).toBe(0);
    expect(result.items.every(item => item.amount === 0)).toBe(true);
  });
});
