/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0b0f17',
          800: '#111827',
          700: '#1f2937',
          600: '#374151',
          500: '#4b5563'
        },
        brand: {
          500: '#f59e0b',
          600: '#d97706',
          400: '#fbbf24'
        }
      }
    },
  },
  plugins: [],
}
