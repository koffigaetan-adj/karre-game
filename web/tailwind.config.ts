import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "var(--ground)",
        surface: "var(--surface)",
        ink: "var(--ink)",
        line: "var(--line)",
        "ink-border": "var(--ink-border)",
      },
      fontFamily: {
        display: ["var(--font-poppins)", "Impact", "sans-serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        stack: "2px 2px 0 0 var(--shadow-ink)",
        "stack-sm": "1.5px 1.5px 0 0 var(--shadow-ink)",
        "stack-pressed": "0.5px 0.5px 0 0 var(--shadow-ink)",
      },
      keyframes: {
        "wave-1": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(15%, 5%) scale(1.1)" },
          "66%": { transform: "translate(5%, 20%) scale(0.9)" },
        },
        "wave-2": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(-20%, -10%) scale(0.95)" },
          "66%": { transform: "translate(-10%, -25%) scale(1.05)" },
        },
        "wave-3": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(20%, -20%) scale(1.1)" },
          "66%": { transform: "translate(-15%, 15%) scale(0.9)" },
        },
      },
      animation: {
        "wave-1": "wave-1 20s ease-in-out infinite",
        "wave-2": "wave-2 25s ease-in-out infinite",
        "wave-3": "wave-3 30s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
