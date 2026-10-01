/** @type {import('tailwindcss').Config} */
// FloTask design tokens — single source of truth (see ../../STYLE_GUIDE.md).
// Components must reference these tokens; never hardcode colors, sizes,
// radii, shadows, or durations in JSX.
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
        // Surfaces — Nothing OS monochrome ladder
        surface: {
          0: '#000000',
          1: '#0a0a0a',
          2: '#111111',
          3: '#1a1a1a',
          4: '#222222',
          5: '#2a2a2a',
          deep: '#050505',
          danger: '#050000',
          'glass-idle': 'rgba(10, 10, 10, 0.5)',
          'glass-active': 'rgba(10, 10, 10, 0.65)',
        },
        // Ink — text hierarchy
        ink: {
          primary: '#ffffff',
          secondary: '#e5e5e5',
          tertiary: '#bbbbbb',
          muted: '#999999',
          soft: '#666666',
          faint: '#555555',
          line: '#444444',
          disabled: '#333333',
        },
        // Accents — red is reserved for high intensity / Enforcer / recording
        accent: {
          red: '#ef4444',
          emerald: '#34d399',
          amber: '#fde68a',
          focus: '#00d4aa',
          'intensity-low': '#4a4a4a',
        },
      },
      // Micro type scale (rem-based so system font scaling works).
      // Line-height intentionally omitted to match the old arbitrary
      // text-[Npx] utilities (font-size only, line-height inherited).
      fontSize: {
        '2xs': '0.6875rem',  // 11px — section labels
        '3xs': '0.625rem',   // 10px — meta text, counts, controls
        '4xs': '0.5625rem',  // 9px  — micro buttons, save indicator
      },
      // Semantic letter-spacing scale (Nothing OS wide tracking)
      letterSpacing: {
        time: '0.1em',      // alarm time
        btn: '0.15em',      // mode toggles
        caption: '0.2em',   // buttons, meta text
        phase: '0.25em',    // phase labels under the ring
        label: '0.3em',     // section labels (TASKS / ALARMS / …)
        hero: '0.35em',     // FLOTASK header
        tagline: '0.4em',   // FOCUS · FLOW · FINISH
      },
      borderRadius: {
        card: '16px',   // .nothing-card
        input: '8px',   // bordered inputs, images, code blocks
        row: '12px',    // task rows, saved notes, mini calendar
      },
      boxShadow: {
        glow: '0 0 10px rgba(255, 255, 255, 0.1)',         // card hover
        'glow-lg': '0 4px 20px rgba(255, 255, 255, 0.08)', // primary hover
        recording: '0 0 14px rgba(239, 68, 68, 0.35)',     // stopwatch running
        glass: '0 0 8px rgba(255, 255, 255, 0.04)',        // stopwatch idle
        danger: '0 0 20px rgba(255, 0, 0, 0.5)',           // Enforcer
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
