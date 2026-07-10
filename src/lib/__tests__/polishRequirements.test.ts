/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { mobilePolishGuards, reducedMotionGuard } from '../polishGuards';
import app from '../../App.tsx?raw';
import auth from '../../components/AuthSyncPanel.tsx?raw';

describe('polish sprint requirements', () => {
  it('mobile layout guards cover safe areas and dynamic viewport instead of fixed desktop-only widths', () => {
    expect(mobilePolishGuards).toContain('env(safe-area-inset-bottom)');
    expect(mobilePolishGuards).toContain('100dvh');
    expect(mobilePolishGuards).toContain('@media (max-width: 860px)');
    expect(mobilePolishGuards).toContain('.edit-row { grid-template-columns: 1fr;');
  });

  it('motion guard covers reduced-motion preferences', () => {
    expect(reducedMotionGuard).toBe('@media (prefers-reduced-motion: reduce)');
  });

  it('Buddy proposed actions expose visible unchanged/applied/cancelled state', () => {
    expect(app).toContain('Föreslagen · inte ändrad än');
    expect(app).toContain('Applicerad · Budgeten ändrad');
    expect(app).toContain('Avbruten · inget ändrat');
  });

  it('important error states tell users whether data changed', () => {
    expect(app).toContain('Inga ändringar gjordes');
    expect(auth).toContain('din lokala Budget finns kvar');
  });

  it('empty states include a next action instead of generic no-data copy', () => {
    expect(app).toContain('Nästa steg:');
    expect(app).not.toContain('No data');
  });
});
