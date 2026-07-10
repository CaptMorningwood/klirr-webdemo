// Stable strings used by tests to guard the focused polish requirements implemented in CSS and UI copy.
export const mobilePolishGuards = [
  'env(safe-area-inset-bottom)',
  '100dvh',
  '@media (max-width: 860px)',
  '.edit-row { grid-template-columns: 1fr;',
] as const;

export const reducedMotionGuard = '@media (prefers-reduced-motion: reduce)';
