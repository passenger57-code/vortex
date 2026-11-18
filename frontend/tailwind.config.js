/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#02050b",
        panel: "#0a1220",
        raised: "#101b2e",
        line: "#1a2a45",
        volt: { DEFAULT: "#1f8bff", 400: "#3fa0ff", 300: "#6bb8ff" },
        cyan: { glow: "#3fd2ff" },
        snow: "#eef3ff",
        mist: "#8c9bb5",
      },
      fontFamily: {
        display: ['"Exo 2"', "system-ui", "sans-serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -6px rgba(31,139,255,.55)",
      },
    },
  },
  plugins: [],
};
