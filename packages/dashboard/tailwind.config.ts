import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        opus: {
          light: '#8b5cf6',   // violet-500
          dark: '#a78bfa',    // violet-400
        },
        sonnet: {
          light: '#3b82f6',   // blue-500
          dark: '#60a5fa',    // blue-400
        },
        haiku: {
          light: '#10b981',   // emerald-500
          dark: '#34d399',    // emerald-400
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
