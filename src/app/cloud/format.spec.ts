import { describe, expect, it } from 'vitest';

import { formatBytes, formatQuotaCounter, formatRecordingDate } from './format';
import { QUOTA_UNLIMITED } from './recordings.types';

describe('formatQuotaCounter', () => {
  it('renders the quiet "Saved N of M plan recordings" counter', () => {
    expect(formatQuotaCounter({ feature: 'recordings.saved', used: 2, limit: 10, plan: 'free' })).toBe(
      'Saved 2 of 10 free recordings.'
    );
  });

  it('singularizes when limit is exactly 1', () => {
    expect(formatQuotaCounter({ feature: 'recordings.saved', used: 1, limit: 1, plan: 'free' })).toBe(
      'Saved 1 of 1 free recording.'
    );
  });

  it('omits the "of N" clause when the plan has no cap', () => {
    expect(formatQuotaCounter({ feature: 'recordings.saved', used: 3, limit: QUOTA_UNLIMITED, plan: 'enterprise' })).toBe(
      'Saved 3 recordings — unlimited on your plan.'
    );
  });

  it('returns null for a missing (best-effort) quota block', () => {
    expect(formatQuotaCounter(null)).toBeNull();
    expect(formatQuotaCounter(undefined)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('renders sub-1024 byte counts verbatim', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('renders KB/MB with one decimal under 10 units, none at/above', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(15 * 1024)).toBe('15 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB');
  });

  it('falls back to an em dash for invalid input', () => {
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('formatRecordingDate', () => {
  it('formats a valid ISO timestamp', () => {
    const formatted = formatRecordingDate('2026-07-24T12:30:00Z');
    expect(formatted).not.toBe('2026-07-24T12:30:00Z');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('returns the raw string for an unparseable timestamp', () => {
    expect(formatRecordingDate('not-a-date')).toBe('not-a-date');
  });
});
