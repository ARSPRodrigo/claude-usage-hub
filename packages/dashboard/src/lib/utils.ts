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

export function modelShortName(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model;
}

/**
 * Get inline style for a model badge — uses CSS custom properties.
 */
export function modelBadgeStyle(name: string, _isDark?: boolean): { backgroundColor: string; color: string } {
  const colorMap: Record<string, string> = {
    Opus: 'var(--m-opus)',
    Sonnet: 'var(--m-sonnet)',
    Haiku: 'var(--m-haiku)',
  };
  const color = colorMap[name] ?? 'var(--ink-3)';
  return {
    backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
    color,
  };
}

export function modelColor(model: string): string {
  if (model.includes('opus')) return 'var(--m-opus)';
  if (model.includes('sonnet')) return 'var(--m-sonnet)';
  if (model.includes('haiku')) return 'var(--m-haiku)';
  return 'var(--ink-3)';
}
