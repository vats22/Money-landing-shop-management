/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#047857',
          hover: '#065F46',
          active: '#064E3B',
          foreground: '#FFFFFF'
        },
        secondary: {
          DEFAULT: '#D97706',
          hover: '#B45309',
          foreground: '#FFFFFF'
        },
        background: {
          app: '#F8FAFC',
          surface: '#FFFFFF'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
