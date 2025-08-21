/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    './index-react.html',
  ],
  theme: {
    extend: {},
  },
  plugins: [require('@tailwindcss/forms')],
}