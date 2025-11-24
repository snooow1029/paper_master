/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        academic: {
          cream: '#F5F5DC',
          beige: '#A39A86',
          lightBeige: '#D2CBBF',
          purple: '#BDB4D3',
          darkBrown: '#5D4037',
          sage: '#707C5D',
        },
      },
      fontFamily: {
        serif: ['"Lora"', '"Merriweather"', '"Georgia"', 'serif'],
      },
    },
  },
  plugins: [],
}
