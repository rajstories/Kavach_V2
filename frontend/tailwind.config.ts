import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kavach: {
          primary: "#0f172a",
          accent: "#ef4444",
          warning: "#f59e0b",
          success: "#10b981",
        },
      },
      fontFamily: {
        sans: ["Space Grotesk", "Noto Sans Devanagari", "sans-serif"],
      },
      boxShadow: {
        panel: "0 20px 55px -25px rgba(15, 23, 42, 0.55)",
      },
    },
  },
  plugins: [],
} satisfies Config;
