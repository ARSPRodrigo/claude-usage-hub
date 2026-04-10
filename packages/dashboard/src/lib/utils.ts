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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function modelColor(model: string): string {
  if (model.includes('opus')) return 'cyan';
  if (model.includes('sonnet')) return 'purple';
  if (model.includes('haiku')) return 'fuchsia';
  return 'slate';
}

/**
 * Get inline style for a model badge.
 * Uses the same hex colors as the charts for consistency.
 */
export function modelBadgeStyle(name: string, isDark: boolean): { backgroundColor: string; color: string } {
  const darkColors: Record<string, string> = {
    Opus: '#22d3ee',
    Sonnet: '#a855f7',
    Haiku: '#d946ef',
  };
  const lightColors: Record<string, string> = {
    Opus: '#0891b2',
    Sonnet: '#7c3aed',
    Haiku: '#c026d3',
  };

  const color = (isDark ? darkColors : lightColors)[name] ?? '#94a3b8';
  return {
    backgroundColor: `${color}${isDark ? '20' : '15'}`,
    color,
  };
}

export function modelShortName(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model;
}
