/** Chart color constants — neon cyberpunk palette. */

/** Dark mode: bright neon colors on dark backgrounds. */
export const MODEL_COLORS_DARK = {
  Opus: '#22d3ee',    // cyan-400
  Sonnet: '#a855f7',  // purple-500
  Haiku: '#d946ef',   // fuchsia-500
} as const;

/** Light mode: deeper shades for readability on white. */
export const MODEL_COLORS_LIGHT = {
  Opus: '#0891b2',    // cyan-600
  Sonnet: '#7c3aed',  // violet-600
  Haiku: '#c026d3',   // fuchsia-600
} as const;

/** Get model colors based on dark mode state. */
export function getModelColors(isDark: boolean) {
  return isDark ? MODEL_COLORS_DARK : MODEL_COLORS_LIGHT;
}

export const ACCENT_COLOR_DARK = '#22d3ee';  // cyan-400
export const ACCENT_COLOR_LIGHT = '#0891b2'; // cyan-600

export function getAccentColor(isDark: boolean) {
  return isDark ? ACCENT_COLOR_DARK : ACCENT_COLOR_LIGHT;
}

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
  tooltipBorder: '#cbd5e1',
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
