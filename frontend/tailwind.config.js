/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <-- This tells it to look inside the components folder!
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}