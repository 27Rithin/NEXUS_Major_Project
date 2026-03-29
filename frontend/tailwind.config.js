/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
      },
      colors: {
        'nexus-red': '#EF4444',
        'nexus-orange': '#F97316',
        'nexus-green': '#22C55E',
        'nexus-blue': '#3B82F6',
        'nexus-bg': '#0B0F19',
      },
    },
  },
  plugins: [],
}
