/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        counter: {
          950: '#0a0f14',
          900: '#101820',
          800: '#16212c',
          700: '#1f2f3d',
          600: '#2b4053',
          accent: '#38bdf8',
          good: '#34d399',
          warn: '#fbbf24',
          bad: '#f87171',
        },
      },
      fontFamily: {
        display: ['"Bahnschrift"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"Cascadia Mono"', '"Consolas"', 'monospace'],
      },
    },
  },
  plugins: [],
}
