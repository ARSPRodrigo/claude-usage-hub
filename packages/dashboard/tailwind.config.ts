import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark theme scale (deep navy-purple)
        dark: {
          950: '#0a0e1a',  // page background
          900: '#0f1325',  // sidebar, header
          800: '#141829',  // cards
          700: '#1e2540',  // elevated elements, hover
          600: '#252d4a',  // borders
          500: '#374166',  // subtle dividers, disabled
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
