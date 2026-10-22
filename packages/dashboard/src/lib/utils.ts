import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatCost(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function truncateId(id: string, len: number = 8): string {
  return id.length > len ? id.slice(0, len) : id;
}

export function formatDate(iso: string): string {
  // Use parseServerTimestamp to handle SQLite CURRENT_TIMESTAMP (UTC, no Z).
  return new Date(parseServerTimestamp(iso)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Parse a server-provided timestamp as UTC.
 *
 * The server stores some columns via SQLite CURRENT_TIMESTAMP, which yields
 * a format like `'2026-05-13 08:47:02'` — space-separated, no timezone
 * marker. Browsers parse this as LOCAL time, which is wrong (SQLite's value
 * is UTC). Detect that format and normalise to ISO 8601 with `Z`.
 *
 * Already-ISO timestamps (containing `T` or ending in `Z`) are passed
 * through unchanged.
 */
export function parseServerTimestamp(ts: string | number): number {
  if (typeof ts === 'number') return ts;
  if (!ts) return Date.now();
  // ISO 8601 already (has T or ends with Z or has timezone offset).
  if (ts.includes('T') || ts.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(ts)) {
    return new Date(ts).getTime();
  }
  // SQLite CURRENT_TIMESTAMP: 'YYYY-MM-DD HH:MM:SS' (UTC).
  return Date.parse(ts.replace(' ', 'T') + 'Z');
}

export function formatRelative(ts: string | number): string {
  const date = parseServerTimestamp(ts);
  const diff = (Date.now() - date) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Mirrors modelDisplayName / modelFamilyName in packages/shared/src/pricing.ts
// (the dashboard doesn't depend on the shared package) — keep the two in step.
const FAMILY_NAMES: Record<string, string> = {
  opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', fable: 'Fable', mythos: 'Mythos',
};

function parseModel(model: string): { family: string; version: string } | null {
  let id = model.trim().toLowerCase();
  const at = id.indexOf('claude-');
  if (at < 0) return null;
  id = id.slice(at).replace(/\[.*\]$/, '').replace(/@.*$/, '').replace(/-v\d+(:\d+)?$/, '').replace(/-\d{8}$/, '');
  const modern = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-[a-z].*)?$/.exec(id);
  if (modern) return { family: modern[1]!, version: [modern[2], modern[3]].filter(Boolean).join('.') };
  const legacy = /^claude-(\d+)(?:-(\d{1,2}))?-([a-z]+)(?:-.*)?$/.exec(id);
  if (legacy) return { family: legacy[3]!, version: [legacy[1], legacy[2]].filter(Boolean).join('.') };
  const bare = /^claude-([a-z]+)(?:-|$)/.exec(id);
  return bare ? { family: bare[1]!, version: '' } : null;
}

function familyLabel(family: string): string {
  return FAMILY_NAMES[family] ?? family.charAt(0).toUpperCase() + family.slice(1);
}

/** "claude-opus-5-5" → "Opus" — for charts, which group by family. Non-Claude ids unchanged. */
export function modelFamilyName(model: string): string {
  const p = parseModel(model);
  return p ? familyLabel(p.family) : model;
}

/** "claude-opus-5-5" → "Opus 5.5", "claude-haiku-4-5-20251001" → "Haiku 4.5". Non-Claude ids unchanged. */
export function modelShortName(model: string): string {
  const p = parseModel(model);
  if (!p) return model;
  return p.version ? `${familyLabel(p.family)} ${p.version}` : familyLabel(p.family);
}

const FAMILY_COLORS: Record<string, string> = {
  Opus: 'var(--m-opus)',
  Sonnet: 'var(--m-sonnet)',
  Haiku: 'var(--m-haiku)',
  Fable: 'var(--m-fable)',
  Mythos: 'var(--m-fable)',
};

/**
 * Get inline style for a model badge — uses CSS custom properties.
 * Accepts a family ("Opus") or a versioned name ("Opus 5.5").
 */
export function modelBadgeStyle(name: string, _isDark?: boolean): { backgroundColor: string; color: string } {
  const color = FAMILY_COLORS[name.split(' ')[0]!] ?? 'var(--ink-3)';
  return {
    backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
    color,
  };
}

export function modelColor(model: string): string {
  return FAMILY_COLORS[modelFamilyName(model)] ?? 'var(--ink-3)';
}
