import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Together AI-inspired midnight blue dark scale
        dark: {
          950: '#010120',  // page background — midnight blue (Together AI exact)
          900: '#04072a',  // sidebar, panels
          800: '#090e3f',  // cards, surfaces
          700: '#141a58',  // elevated elements, hover states
          600: '#1c2568',  // borders, dividers
          500: '#323d88',  // muted text, disabled
        },
      },
      boxShadow: {
        // Together AI blue-tinted shadow
        'card': 'rgba(1, 1, 32, 0.10) 0px 4px 10px',
        'card-hover': 'rgba(1, 1, 32, 0.18) 0px 8px 20px',
        'popover': 'rgba(1, 1, 32, 0.20) 0px 8px 24px',
      },
      letterSpacing: {
        'heading': '-0.02em',
        'heading-lg': '-0.03em',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
