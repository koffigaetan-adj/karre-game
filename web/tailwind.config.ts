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
      },
      fontFamily: {
        display: ["var(--font-poppins)", "Impact", "sans-serif"],
        body: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        stack: "2px 2px 0 0 var(--shadow-ink)",
        "stack-sm": "1.5px 1.5px 0 0 var(--shadow-ink)",
        "stack-pressed": "0.5px 0.5px 0 0 var(--shadow-ink)",
      },
    },
  },
  plugins: [],
};

export default config;
