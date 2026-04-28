/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{svelte,ts}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: '#090b0f',
          900: '#10131a',
          850: '#171b24',
          800: '#1e2430'
        },
        focus: '#4fd1c5',
        ember: '#f97316'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
