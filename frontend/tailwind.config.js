/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        capy: {
          bg: 'var(--bg-color)',
          surface: 'var(--surface-1)',
          muted: 'var(--text-secondary-color)',
        },
      },
      borderRadius: {
        capy: 'var(--radius-lg)',
      },
      boxShadow: {
        capy: 'var(--shadow-card)',
        nav: 'var(--shadow-nav)',
      },
    },
  },
  plugins: [],
};
