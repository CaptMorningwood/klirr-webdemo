import { describe, expect, it } from 'vitest';
import app from '../App.tsx?raw';
import buddy from '../lib/budgetBuddy.ts?raw';

describe('Budget Buddy quick choices', () => {
  it('uses a central typed suggestion list with the new terminology', () => {
    expect(buddy).toContain('export const buddySuggestionItems');
    expect(buddy).toContain("label: 'Hjälp mig justera inkomsten'");
    expect(buddy).toContain("label: 'Föreslå rörliga utgifter'");
  });

  it('renders suggestions behind a compact accessible trigger instead of inline chips', () => {
    expect(app).toContain('Snabbval ✨');
    expect(app).toContain('aria-haspopup="dialog"');
    expect(app).toContain('aria-expanded={quickChoicesOpen}');
    expect(app).toContain('quick-choice-popover');
    expect(app).not.toContain('inline-suggestions');
    expect(app).not.toContain('suggestion-chip');
  });

  it('closes after selection, outside pointer and Escape, and returns focus to the trigger', () => {
    expect(app).toContain('setQuickChoicesOpen(false);');
    expect(app).toContain("event.key !== 'Escape'");
    expect(app).toContain("document.addEventListener('mousedown', closeFromPointer)");
    expect(app).toContain('quickChoicesTriggerRef.current?.focus()');
  });
});
