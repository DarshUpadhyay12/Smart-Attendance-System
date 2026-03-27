/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: "#0d1117",
        neonPurple: "#b026ff",
        neonCyan: "#00f0ff",
        neonGreen: "#39ff14",
      }
    },
  },
  plugins: [],
}
