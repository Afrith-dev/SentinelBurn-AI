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
        space: {
          950: '#04070c',
          900: '#080d1a',
          850: '#0e1626',
          800: '#142036',
          700: '#1f2e4d',
          600: '#2d426b',
        },
        cyber: {
          cyan: '#00f0ff',
          glow: 'rgba(0, 240, 255, 0.15)',
        },
        alert: {
          critical: '#ff3366',
          warning: '#ffb800',
          info: '#3b82f6',
          nominal: '#00ff88',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'cyan-glow': '0 0 15px rgba(0, 240, 255, 0.3)',
        'crimson-glow': '0 0 15px rgba(255, 51, 102, 0.4)',
        'amber-glow': '0 0 15px rgba(255, 184, 0, 0.3)',
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-glow': 'pulseGlow 2s infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 1, filter: 'drop-shadow(0 0 8px #00f0ff)' },
          '50%': { opacity: 0.6, filter: 'drop-shadow(0 0 2px #00f0ff)' },
        }
      }
    },
  },
  plugins: [],
}
