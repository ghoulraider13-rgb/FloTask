/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Space Mono"', '"Roboto Mono"', '"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        dotmatrix: ['"DotGothic16"', '"Space Mono"', 'monospace'],
      },
      colors: {
        surface: {
          0: '#000000',
          1: '#0a0a0a',
          2: '#111111',
          3: '#1a1a1a',
          4: '#222222',
          5: '#2a2a2a',
          deep: '#050505',
        },
        accent: {
          red: '#ef4444',
          emerald: '#34d399',
          amber: '#fde68a',
          focus: '#00d4aa',
        },
        ink: {
          primary: '#ffffff',
          secondary: '#e5e5e5',
          tertiary: '#bbbbbb',
          muted: '#999999',
          faint: '#555555',
          disabled: '#333333',
        },
      },
      borderRadius: {
        card: '16px',
        pill: '9999px',
        input: '8px',
        row: '12px',
      },
      boxShadow: {
        glow: '0 0 10px rgba(255, 255, 255, 0.1)',
        'glow-lg': '0 4px 20px rgba(255, 255, 255, 0.08)',
        recording: '0 0 14px rgba(239, 68, 68, 0.35)',
        glass: '0 0 8px rgba(255, 255, 255, 0.04)',
        danger: '0 0 20px rgba(255, 0, 0, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-out': 'fadeOut 0.3s ease-in forwards',
        'slide-up': 'slideUp 0.3s ease-out',
        'check-pop': 'checkPop 0.35s ease-out',
        'shake': 'shake 0.6s ease-out',
        'pulse-slow': 'pulseSlow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeOut: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(8px)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        checkPop: {
          '0%': { transform: 'scale(1)' },
          '40%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [],
}