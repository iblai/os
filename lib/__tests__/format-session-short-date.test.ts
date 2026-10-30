import { describe, expect, it } from 'vitest';

import { formatSessionShortDate } from '../format-session-short-date';

describe('formatSessionShortDate', () => {
  const now = new Date('2026-10-30T15:00:00');

  it('shows only the time for today', () => {
    expect(formatSessionShortDate('2026-10-30T09:05:00', now)).toBe('9:05 AM');
  });

  it('shows month and day earlier this year', () => {
    expect(formatSessionShortDate('2026-10-15T22:11:00', now)).toBe('Oct 15');
  });

  it('adds the year for older conversations', () => {
    expect(formatSessionShortDate('2024-03-15T10:30:00', now)).toBe(
      'Mar 15, 2024',
    );
  });

  it('is empty for a missing or invalid value', () => {
    expect(formatSessionShortDate(null, now)).toBe('');
    expect(formatSessionShortDate('not-a-date', now)).toBe('');
  });
});
