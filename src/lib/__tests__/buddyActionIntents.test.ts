import { describe, expect, it } from 'vitest';
import { detectBuddyActionIntent } from '../buddyActionIntents';

describe('detectBuddyActionIntent', () => {
  it('detects confirm phrases', () => {
    expect(detectBuddyActionIntent('ja gör det')).toBe('confirm');
  });
  it('detects cancel phrases', () => {
    expect(detectBuddyActionIntent('nej låt bli')).toBe('cancel');
  });
  it('returns null for unclear phrases', () => {
    expect(detectBuddyActionIntent('kanske')).toBeNull();
  });
});
