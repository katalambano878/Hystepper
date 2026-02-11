/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./{app,components,libs,pages,hooks}/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
        handwriting: ['Pacifico', 'cursive'],
      },
      colors: {
        gold: {
          50: '#fdf9ef',
          100: '#faf0d5',
          200: '#f4deaa',
          300: '#edc874',
          400: '#e5ab42',
          500: '#dc9527',
          600: '#c4761c',
          700: '#a3571a',
          800: '#85451c',
          900: '#6e3a1a',
          950: '#3d1c0b',
        },
      },
    },
  },
  plugins: [],
}
