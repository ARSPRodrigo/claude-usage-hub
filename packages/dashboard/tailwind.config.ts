import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Redesign: semantic tokens referencing CSS custom properties
        // Values auto-switch between light/dark via .dark class on <html>
        canvas: {
          DEFAULT: 'var(--bg)',
          alt: 'var(--bg-2)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)',
          4: 'var(--ink-4)',
        },
        line: {
          DEFAULT: 'var(--line)',
          2: 'var(--line-2)',
        },
        accent: 'var(--accent)',
        pos: 'var(--pos)',
        neg: 'var(--neg)',
        surface: 'var(--surface)',
        model: {
          opus: 'var(--m-opus)',
          sonnet: 'var(--m-sonnet)',
          haiku: 'var(--m-haiku)',
        },
      },
      fontFamily: {
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'hero': ['44px', { lineHeight: '1', letterSpacing: '-0.035em', fontWeight: '500' }],
        'stat': ['30px', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '500' }],
        'title': ['36px', { lineHeight: '1.05', letterSpacing: '-0.025em', fontWeight: '500' }],
        'card-title': ['15.5px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '500' }],
        'label': ['10.5px', { lineHeight: '1.3', letterSpacing: '0.08em', fontWeight: '500' }],
      },
      borderRadius: {
        'pill': '3px',
        'btn': '5px',
        'card': '6px',
      },
      boxShadow: {
        'popover': '0 12px 28px rgba(0,0,0,0.14)',
        'tooltip': '0 4px 14px rgba(0,0,0,0.06)',
      },
      spacing: {
        '4.5': '18px',
        '5.5': '22px',
      },
    },
  },
  plugins: [],
} satisfies Config;
