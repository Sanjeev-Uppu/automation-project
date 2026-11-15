/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        amethyst: {
          50: "#F5EEFB", 100: "#EBDDF7", 200: "#D7BDEF", 300: "#BF98E0", 400: "#AC7DD6",
          500: "#9966CC", 600: "#7F4FB2", 700: "#653D91", 800: "#4D2F70", 900: "#362150",
        },
        plum: {
          50: "#FBF1FA", 100: "#F3E2F1", 200: "#E4C2E0", 300: "#CE97C7", 400: "#B06AA6",
          500: "#8E4585", 600: "#763870", 700: "#5F2D5A", 800: "#47224A", 900: "#321832",
        },
        cream: { 50: "#FFFCF6", 100: "#FFF7E8", 200: "#F8EBD2", 300: "#EEDDBE" },
        sand: {
          100: "#F7EBD0", 200: "#EFD9A8", 300: "#E5C78A", 400: "#DEBE7C", 500: "#D8B56D",
          600: "#B8934A", 700: "#8C6D32",
        },
        ink: { DEFAULT: "#2B1F33", soft: "#5E4F68", faint: "#8A7C93" },
        line: "#E8DCC6",
        ok: "#4F7F5E",
        danger: "#A93B2B",
      },
      fontFamily: {
        display: ['"Fraunces Variable"', "Georgia", "serif"],
        sans: ['"Instrument Sans Variable"', "system-ui", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(50,24,50,.06), 0 6px 20px -8px rgba(50,24,50,.12)",
        pop: "0 12px 40px -12px rgba(50,24,50,.35)",
      },
    },
  },
  plugins: [],
};
