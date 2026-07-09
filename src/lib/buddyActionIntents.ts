export type BuddyActionIntent = 'confirm' | 'cancel' | null;

const CONFIRM_PATTERNS = [/\bja\b/i, /\bkör\b/i, /uppdatera/i, /gör det/i, /absolut/i, /ja tack/i, /låter bra/i, /\byes\b/i, /\bok\b/i];
const CANCEL_PATTERNS = [/\bnej\b/i, /avbryt/i, /låt bli/i, /inte nu/i, /nej tack/i];

export function detectBuddyActionIntent(message: string): BuddyActionIntent {
  const text = message.trim().toLowerCase();
  if (!text) return null;
  if (CANCEL_PATTERNS.some(pattern => pattern.test(text))) return 'cancel';
  if (CONFIRM_PATTERNS.some(pattern => pattern.test(text))) return 'confirm';
  return null;
}
