import { describe, expect, it } from 'vitest';
import { estimateSwedishNetSalary } from '../taxEstimate';

describe('estimateSwedishNetSalary', () => {
  it('estimates 50000 gross at 32 percent as about 34000 net', () => {
    expect(estimateSwedishNetSalary({ grossMonthly: 50000, municipalTaxRate: 0.32 }).netMonthly).toBe(34000);
  });
  it('rounds to nearest 100 kr', () => {
    expect(estimateSwedishNetSalary({ grossMonthly: 50123, municipalTaxRate: 0.32 }).netMonthly % 100).toBe(0);
  });
  it('rejects invalid gross salary', () => {
    expect(() => estimateSwedishNetSalary({ grossMonthly: -1 })).toThrow();
  });
});
