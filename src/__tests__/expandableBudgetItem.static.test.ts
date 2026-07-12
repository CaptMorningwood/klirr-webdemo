import { describe, expect, it } from 'vitest';
import app from '../App.tsx?raw';

describe('expandable economic item pattern', () => {
  it('renders compact rows with accordion semantics and deferred controls', () => {
    expect(app).toContain('function ExpandableBudgetItem');
    expect(app).toContain('aria-expanded');
    expect(app).toContain('aria-controls');
    expect(app).toContain('role="region"');
    expect(app).toContain('budget-row-panel');
  });

  it('keeps only one item open in the same list and does not persist UI state to Budget data', () => {
    expect(app).toContain("new CustomEvent('klirr:accordion-open'");
    expect(app).toContain('setOpen(false)');
    expect(app).not.toContain('expandedRows');
    expect(app).not.toContain('openBudgetItem');
  });

  it('covers the audited economic views with the shared row pattern', () => {
    const occurrences = app.match(/<ExpandableBudgetItem/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(7);
    expect(app).toContain('Importerade måsten redigeras som overrides. Kontoutdraget ändras inte.');
    expect(app).toContain('Konton används för att förstå interna överföringar');
  });

  it('keeps expanded controls behind compact row panels', () => {
    expect(app).toContain('className="budget-detail-grid"');
    expect(app).toContain('className="budget-detail-actions"');
    expect(app).toContain('className="budget-row-side"');
  });
});
