/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Arial', 'Helvetica', 'sans-serif'],
        mono: ["'Fira Code'", 'Consolas', 'monospace'],
      },
      colors: {
        slate: {
          850: '#151b2b',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
