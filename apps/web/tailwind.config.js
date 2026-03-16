export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['DM Sans', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          light:   '#00C7FD',
          DEFAULT: '#0071C5',
          dark:    '#004A84',
          darker:  '#003366',
        },
        surface: {
          0:   '#ffffff',
          50:  '#f5f8fc',
          100: '#eaf1f8',
          200: '#d0e2f0',
          400: '#7aaac8',
          500: '#4d88ad',
          700: '#1a4a6e',
          800: '#0d2e47',
          900: '#071c2e',
          950: '#030e18',
        },
        risk: {
          high:     '#ef4444',
          moderate: '#f59e0b',
          monitor:  '#0071C5',
          ontrack:  '#10b981',
        }
      },
      boxShadow: {
        card:       '0 1px 3px 0 rgb(0 113 197 / 0.08), 0 1px 2px -1px rgb(0 113 197 / 0.06)',
        'card-hover': '0 4px 16px 0 rgb(0 113 197 / 0.15), 0 2px 4px -1px rgb(0 113 197 / 0.08)',
      }
    },
  },
  plugins: [],
}
