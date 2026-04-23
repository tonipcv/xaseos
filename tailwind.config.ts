import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: '#F5F2EF',
          100: '#EBE6E1',
          200: '#D8D0C4',
          300: '#C4B8A8',
          400: '#B8ADA0',
          500: '#A89B8D',
        },
        warmgray: {
          400: '#A8A098',
          500: '#8F8780',
          600: '#7A726B',
          700: '#5F5A57',
          800: '#4A4542',
        },
        slateblue: {
          400: '#6B7A8F',
          500: '#3F4E63',
          600: '#2F3E52',
          700: '#1F3552',
          800: '#152842',
          900: '#0D1F33',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
