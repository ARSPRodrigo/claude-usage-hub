import { describe, it, expect } from 'vitest';
import { formatTokens, formatCost, formatDuration, truncateId, modelShortName, modelFamilyName, modelBadgeStyle } from '../lib/utils';

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
  it('includes the version', () => expect(modelShortName('claude-opus-4-6')).toBe('Opus 4.6'));
  it('handles single-number versions', () => expect(modelShortName('claude-sonnet-5')).toBe('Sonnet 5'));
  it('drops date snapshots', () => expect(modelShortName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5'));
  it('handles legacy ids', () => expect(modelShortName('claude-3-5-haiku-20241022')).toBe('Haiku 3.5'));
  it('handles new families', () => expect(modelShortName('claude-fable-5-1')).toBe('Fable 5.1'));
  it('returns raw name for unknown', () => expect(modelShortName('gpt-4')).toBe('gpt-4'));
});

describe('modelFamilyName', () => {
  it('returns the family', () => expect(modelFamilyName('claude-opus-5-5')).toBe('Opus'));
  it('returns raw name for unknown', () => expect(modelFamilyName('gpt-4')).toBe('gpt-4'));
});

describe('modelBadgeStyle', () => {
  it('returns CSS variable color for Opus', () => {
    const style = modelBadgeStyle('Opus');
    expect(style.color).toBe('var(--m-opus)');
  });
  it('returns same color regardless of dark flag (CSS variables handle theming)', () => {
    expect(modelBadgeStyle('Opus', true).color).toBe(modelBadgeStyle('Opus', false).color);
  });
  it('returns CSS variable color for Sonnet', () => {
    expect(modelBadgeStyle('Sonnet').color).toBe('var(--m-sonnet)');
  });
  it('returns CSS variable color for Haiku', () => {
    expect(modelBadgeStyle('Haiku').color).toBe('var(--m-haiku)');
  });
  it('returns fallback for unknown model', () => {
    expect(modelBadgeStyle('Unknown').color).toBe('var(--ink-3)');
  });

  it('colours versioned names by family', () => {
    expect(modelBadgeStyle('Opus 5.5').color).toBe('var(--m-opus)');
    expect(modelBadgeStyle('Fable 5.1').color).toBe('var(--m-fable)');
  });
  it('includes semi-transparent background via color-mix', () => {
    const style = modelBadgeStyle('Opus');
    expect(style.backgroundColor).toContain('var(--m-opus)');
    expect(style.backgroundColor).toContain('color-mix');
  });
});
