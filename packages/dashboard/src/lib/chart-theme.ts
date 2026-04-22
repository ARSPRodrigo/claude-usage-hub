/**
 * Chart color constants — muted oklch palette matching the redesign tokens.
 * Colors are defined as CSS custom properties in index.css and auto-switch
 * between light and dark. For Recharts (which needs concrete values in JS),
 * we read them from getComputedStyle at render time.
 */

/** Resolve a CSS custom property to its computed value. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Get model colors as computed CSS values (works in both light/dark). */
export function getModelColors(_isDark?: boolean): Record<string, string> {
  return {
    Opus: cssVar('--m-opus'),
    Sonnet: cssVar('--m-sonnet'),
    Haiku: cssVar('--m-haiku'),
  };
}

/** Accent color from the current theme. */
export function getAccentColor(_isDark?: boolean): string {
  return cssVar('--accent');
}

/** Theme colors for chart elements — derived from CSS custom properties. */
export function getTheme(_isDark?: boolean) {
  return {
    grid: cssVar('--line-2'),
    axis: cssVar('--ink-3'),
    tooltipBg: cssVar('--surface'),
    tooltipBorder: cssVar('--line'),
    tooltipText: cssVar('--ink'),
    cursor: cssVar('--line'),
  };
}

/** Gradient definitions for area chart fills. */
export function modelGradientId(model: string): string {
  return `gradient-${model.toLowerCase()}`;
}
