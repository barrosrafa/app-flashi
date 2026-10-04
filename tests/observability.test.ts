import { describe, expect, it } from 'vitest';
import { normalizeErrorCode, weeklyMinutesBucket } from '../lib/observability';

describe('observability contracts', () => {
  it('buckets weekly minutes without raw values', () => {
    expect(weeklyMinutesBucket('30')).toBe('0-59');
    expect(weeklyMinutesBucket('180')).toBe('180-359');
    expect(weeklyMinutesBucket('1500')).toBe('1200+');
    expect(weeklyMinutesBucket('abc')).toBe('none');
  });
  it('normalizes stable error codes', () => {
    expect(normalizeErrorCode(new Error('INVALID_TARGET_DATE: details'))).toBe('INVALID_TARGET_DATE');
    expect(normalizeErrorCode('network unavailable')).toBe('UNKNOWN_ERROR');
  });
});
