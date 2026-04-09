/** Chart color constants — neon cyberpunk palette. */
export const MODEL_COLORS = {
  Opus: '#22d3ee',    // cyan-400
  Sonnet: '#a855f7',  // purple-500
  Haiku: '#d946ef',   // fuchsia-500
} as const;

export const ACCENT_COLOR = '#22d3ee'; // cyan-400

/** Dark theme colors for chart elements. */
export const DARK_THEME = {
  grid: '#1e2540',
  axis: '#7b8baa',
  tooltipBg: '#141829',
  tooltipBorder: '#252d4a',
  tooltipText: '#e2e8f0',
  cursor: 'rgba(123, 139, 170, 0.15)',
} as const;

/** Light theme colors for chart elements. */
export const LIGHT_THEME = {
  grid: '#e2e8f0',
  axis: '#64748b',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e2e8f0',
  tooltipText: '#1e293b',
  cursor: 'rgba(100, 116, 139, 0.1)',
} as const;

/** Get theme colors based on dark mode state. */
export function getTheme(isDark: boolean) {
  return isDark ? DARK_THEME : LIGHT_THEME;
}

/** Gradient definitions for area chart fills. */
export function modelGradientId(model: string): string {
  return `gradient-${model.toLowerCase()}`;
}
