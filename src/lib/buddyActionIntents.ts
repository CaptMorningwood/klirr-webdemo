export type BuddyActionIntent = 'confirm' | 'cancel' | null;

const TROUBLESHOOTING_PATTERNS = [/varför/i, /varfor/i, /hände inget/i, /hande inget/i, /dök/i, /dok/i, /uppdaterades inte/i, /ändrades inte/i, /andrades inte/i, /gjorde du/i, /uppdaterade du/i];
const CONFIRM_PATTERNS = [/^\s*ja\s*$/i, /ja tack/i, /\bgör det\b/i, /\bkör\b/i, /\babsolut\b/i, /låter bra/i, /\byes\b/i, /^\s*ok\s*$/i, /använd förslaget/i, /uppdatera min inkomst/i, /ändra det/i];
const CANCEL_PATTERNS = [/^\s*nej\s*$/i, /nej tack/i, /avbryt/i, /låt bli/i, /inte nu/i, /\bbehåll\b/i, /låt den vara/i];

export function detectBuddyActionIntent(message: string): BuddyActionIntent {
  const text = message.trim().toLowerCase();
  if (!text) return null;
  if (TROUBLESHOOTING_PATTERNS.some(pattern => pattern.test(text))) return null;
  if (CANCEL_PATTERNS.some(pattern => pattern.test(text))) return 'cancel';
  if (CONFIRM_PATTERNS.some(pattern => pattern.test(text))) return 'confirm';
  return null;
}
