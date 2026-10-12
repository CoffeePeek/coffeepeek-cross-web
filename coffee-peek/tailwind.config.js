/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#EAB308",
          hover: "#FACC15",
          dark: "#CA8A04",
          light: "#FEF3C7",
        },
        "gold-warm": {
          DEFAULT: "#D4A84B",
          hover: "#B68A2E",
          soft: "#F8F1DD",
        },
        background: {
          light: "#FAFAF9",
          dark: "#1A1412",
        },
        surface: {
          white: "#FFFFFF",
          dark: "#2D241F",
        },
        text: {
          main: "#1C1917",
          muted: "#78716C",
        },
        border: {
          light: "#E7E5E4",
          dark: "#3D2F28",
        },
        status: {
          pending: "#F59E0B",
          approved: "#10B981",
          rejected: "#EF4444",
        },
      },
      fontFamily: {
        body: ["Manrope", "sans-serif"],
        condensed: ["Manrope", "sans-serif"],
        extended: ["Manrope", "sans-serif"],
        expanded: ["Manrope", "sans-serif"],
      },
      letterSpacing: {
        wordmark: "-0.045em",
        hero: "-0.01em",
        heading: "-0.02em",
      },
      lineHeight: {
        hero: "0.92",
        stamp: "0.84",
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
