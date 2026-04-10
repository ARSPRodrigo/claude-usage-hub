import { describe, it, expect } from 'vitest';
import { formatTokens, formatCost, formatDuration, truncateId, modelShortName, modelBadgeClasses } from '../lib/utils';

describe('formatTokens', () => {
  it('formats billions', () => expect(formatTokens(3_000_000_000)).toBe('3.0B'));
  it('formats millions', () => expect(formatTokens(1_500_000)).toBe('1.5M'));
  it('formats thousands', () => expect(formatTokens(42_000)).toBe('42.0K'));
  it('formats small numbers', () => expect(formatTokens(500)).toBe('500'));
  it('formats zero', () => expect(formatTokens(0)).toBe('0'));
});

describe('formatCost', () => {
  it('formats large costs without decimals', () => expect(formatCost(1234)).toBe('$1,234'));
  it('formats medium costs with 2 decimals', () => expect(formatCost(42.5)).toBe('$42.50'));
  it('formats small costs with 2 decimals', () => expect(formatCost(0.05)).toBe('$0.05'));
  it('formats tiny costs with 4 decimals', () => expect(formatCost(0.001)).toBe('$0.0010'));
});

describe('formatDuration', () => {
  it('formats minutes', () => {
    expect(formatDuration('2026-04-01T10:00:00Z', '2026-04-01T10:30:00Z')).toBe('30m');
  });
  it('formats hours and minutes', () => {
    expect(formatDuration('2026-04-01T10:00:00Z', '2026-04-01T12:15:00Z')).toBe('2h 15m');
  });
  it('formats exact hours', () => {
    expect(formatDuration('2026-04-01T10:00:00Z', '2026-04-01T13:00:00Z')).toBe('3h');
  });
  it('handles very short durations', () => {
    expect(formatDuration('2026-04-01T10:00:00Z', '2026-04-01T10:00:30Z')).toBe('<1m');
  });
});

describe('truncateId', () => {
  it('truncates long IDs', () => expect(truncateId('abcdefghijklmnop')).toBe('abcdefgh'));
  it('keeps short IDs', () => expect(truncateId('abc')).toBe('abc'));
  it('respects custom length', () => expect(truncateId('abcdefghij', 4)).toBe('abcd'));
});

describe('modelShortName', () => {
  it('returns Opus', () => expect(modelShortName('claude-opus-4-6')).toBe('Opus'));
  it('returns Sonnet', () => expect(modelShortName('claude-sonnet-4-6')).toBe('Sonnet'));
  it('returns Haiku', () => expect(modelShortName('claude-haiku-4-5-20251001')).toBe('Haiku'));
  it('returns raw name for unknown', () => expect(modelShortName('gpt-4')).toBe('gpt-4'));
});

describe('modelBadgeClasses', () => {
  it('returns cyan classes for Opus', () => {
    expect(modelBadgeClasses('Opus')).toContain('cyan');
  });
  it('returns purple classes for Sonnet', () => {
    expect(modelBadgeClasses('Sonnet')).toContain('purple');
  });
  it('returns fuchsia classes for Haiku', () => {
    expect(modelBadgeClasses('Haiku')).toContain('fuchsia');
  });
  it('returns slate classes for unknown', () => {
    expect(modelBadgeClasses('Unknown')).toContain('slate');
  });
});
