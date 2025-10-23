/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary': 'var(--color-primary)',
        'secondary': 'var(--color-secondary)',
        'accent': 'var(--color-accent)',
        'buttons': 'var(--color-buttons)',
        'text-base': 'var(--color-text-base)',
        'text-muted': 'var(--color-text-muted)',
        'text-button': 'var(--color-text-button)',
        'starker-yellow': 'var(--color-accent)',
        'starker-dark': 'var(--color-primary)',
        'starker-gray': 'var(--color-secondary)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
