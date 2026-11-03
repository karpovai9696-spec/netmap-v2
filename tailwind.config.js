/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // палитра визитки MKSPEC (portfolio-website)
        primary: { DEFAULT: '#FCD116', hover: '#E3BC0E', soft: '#FFF8D6' },
        accent: '#8E751D',
        gold: '#8E751D',
        golddeep: '#6B5A17',
        cyber: { bg: '#09090A', card: '#17171A', text: '#FFF5B8', muted: '#3F3820' },
        paper: { DEFAULT: '#FFFDF0', soft: '#FFF8D6', raised: '#FFFEF6' },
        ink: {
          50: '#6B6552', 100: '#6B6552', 300: '#B9B28F', 400: '#8F8A6E', 500: '#6B6552',
          700: '#2E2C1E', 800: '#1F1F23', 900: '#17171A', 950: '#09090A',
        },
        hairline: '#E6E0C2',

        // Глобальный ре-теминг: замена серо-синей палитры Gemini на палитру визитки
        slate: {
          50: '#FFFDF0', 100: '#FFF5B8', 200: '#E6E0C2', 300: '#D8D2B4', 400: '#B9B28F',
          500: '#8F8A6E', 600: '#6B6552', 700: '#3F3820', 800: '#26251D', 900: '#17171A',
          950: '#09090A',
        },
        // Синий акцент -> фирменный жёлтый
        blue: {
          50: '#FFFDF0', 100: '#FFF8D6', 200: '#FEF3C7', 300: '#FDE68A', 400: '#FCD116',
          500: '#FCD116', 600: '#E3BC0E', 700: '#8E751D', 800: '#6B5A17', 900: '#3F3820',
          950: '#26251D',
        },
      },
      fontFamily: {
        display: ['Montserrat', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'Menlo', 'monospace'],
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(1)', opacity: '0.55' },
          '80%, 100%': { transform: 'scale(2.1)', opacity: '0' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'fade-in-up': 'fade-in-up .35s ease-out both',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(252,209,22,.28), 0 0 26px rgba(252,209,22,.14)',
      },
    },
  },
  plugins: [],
};
