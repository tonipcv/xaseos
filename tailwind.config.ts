import type { Config } from "tailwindcss";

export default {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50:  'rgb(var(--sand-50)  / <alpha-value>)',
          100: 'rgb(var(--sand-100) / <alpha-value>)',
          200: 'rgb(var(--sand-200) / <alpha-value>)',
          300: 'rgb(var(--sand-300) / <alpha-value>)',
          400: 'rgb(var(--sand-400) / <alpha-value>)',
          500: 'rgb(var(--sand-500) / <alpha-value>)',
        },
        warmgray: {
          400: 'rgb(var(--wg-400) / <alpha-value>)',
          500: 'rgb(var(--wg-500) / <alpha-value>)',
          600: 'rgb(var(--wg-600) / <alpha-value>)',
          700: 'rgb(var(--wg-700) / <alpha-value>)',
          800: 'rgb(var(--wg-800) / <alpha-value>)',
        },
        slateblue: {
          400: 'rgb(var(--sb-400) / <alpha-value>)',
          500: 'rgb(var(--sb-500) / <alpha-value>)',
          600: 'rgb(var(--sb-600) / <alpha-value>)',
          700: 'rgb(var(--sb-700) / <alpha-value>)',
          800: 'rgb(var(--sb-800) / <alpha-value>)',
          900: 'rgb(var(--sb-900) / <alpha-value>)',
        },
      },
      keyframes: {
        'slide-in-from-bottom-2': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to:   { transform: 'translateY(0)',   opacity: '1' },
        },
      },
      animation: {
        'in': 'slide-in-from-bottom-2 0.2s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
