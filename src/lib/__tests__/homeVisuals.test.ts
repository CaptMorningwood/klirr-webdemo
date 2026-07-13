import { describe, expect, it } from 'vitest';
import type { BudgetLine } from '../../types';
import { buildBudgetDistribution, groupVariableDistribution, incomeSourceDistribution, marginSafety, mustsStatus } from '../homeVisuals';

const line = (label: string, amount: number, category = label): BudgetLine => ({ id: label, label, amount, category, source: 'manual' });

describe('home Budget visuals', () => {
  it('calculates top Budget shares and safe widths', () => {
    const result = buildBudgetDistribution({ totalIncome: 10000, fixedTotal: 5800, variablePlanTotal: 2900, margin: 1300 });
    expect(result.segments.map(s => Math.round(s.share))).toEqual([58, 29, 13]);
    expect(result.segments.every(s => s.width >= 0)).toBe(true);
  });

  it('handles zero income, negative margin and over-allocation without negative widths', () => {
    const zero = buildBudgetDistribution({ totalIncome: 0, fixedTotal: 0, variablePlanTotal: 0, margin: 0 });
    expect(zero.segments.every(s => s.width >= 0)).toBe(true);
    const over = buildBudgetDistribution({ totalIncome: 1000, fixedTotal: 900, variablePlanTotal: 400, margin: -300 });
    expect(over.overAllocated).toBe(true);
    expect(over.deficit).toBe(300);
    expect(over.segments.every(s => s.width >= 0)).toBe(true);
    expect(Math.round(over.segments.reduce((sum, s) => sum + s.width, 0))).toBe(100);
  });

  it('calculates musts share with clamped visual and no-income fallback', () => {
    expect(mustsStatus(1200, 1000)).toMatchObject({ share: 120, width: 100 });
    expect(mustsStatus(500, 0).text).toBe('Andel kan inte beräknas ännu');
  });

  it('groups variable categories deterministically and finds largest', () => {
    const result = groupVariableDistribution([line('Mat och hushåll', 5200), line('Transport', 1000), line('Nöje', 800), line('Buffert', 1000, 'Sparande'), line('Kläder', 2000, 'Övrigt')]);
    expect(result.segments.map(s => s.label)).toEqual(['Mat och hushåll', 'Transport', 'Nöje', 'Övrigt', 'Buffert/sparande']);
    expect(Math.round(result.segments.reduce((sum, s) => sum + s.share, 0))).toBe(100);
    expect(result.largest?.label).toBe('Mat och hushåll');
    expect(groupVariableDistribution([]).total).toBe(0);
  });

  it('uses Budget Health margin thresholds for safety states', () => {
    expect(marginSafety(-1, 1000).state).toBe('negative');
    expect(marginSafety(40, 1000).state).toBe('thin');
    expect(marginSafety(100, 1000).state).toBe('reasonable');
    expect(marginSafety(150, 1000).state).toBe('strong');
  });

  it('only shows income distribution for multiple meaningful types', () => {
    expect(incomeSourceDistribution([line('Lön efter skatt', 30000)]).shouldShow).toBe(false);
    const mixed = incomeSourceDistribution([line('Lön efter skatt', 30000), line('Barnbidrag support', 1250)]);
    expect(mixed.shouldShow).toBe(true);
    expect(Math.round(mixed.segments.reduce((sum, s) => sum + s.share, 0))).toBe(100);
  });
});
