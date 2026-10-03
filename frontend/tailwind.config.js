/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Segoe UI", "sans-serif"],
      },
      colors: {
        ink: {
          950: "#07111f",
          900: "#0c1929",
          800: "#132338",
          700: "#1c334d",
        },
        brand: {
          50: "#ecfeff",
          100: "#cffafe",
          400: "#22d3ee",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)",
        lift: "0 12px 40px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
