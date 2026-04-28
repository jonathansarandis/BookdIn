import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#e6eeff',
          100: '#c0d0ff',
          200: '#99b2ff',
          300: '#7EB0FF',
          400: '#4D8CFF',
          500: '#2563FF',
          600: '#1a4fd6',
          700: '#1240b0',
          800: '#0c2f80',
          900: '#071f55',
        },
        navy: {
          DEFAULT: '#0A0F1E',
          mid:     '#111827',
          light:   '#1E2A45',
        },
        silver: '#C8D4F0',
        amber:  '#F59E0B',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
