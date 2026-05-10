import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4f7ff",
          100: "#e8efff",
          500: "#22d3ee",
          600: "#0891b2",
          900: "#06131a"
        },
        neon: {
          blue: "#22d3ee",
          soft: "#67e8f9",
          deep: "#0e7490"
        }
      },
      boxShadow: {
        glow: "0 0 40px rgba(34, 211, 238, 0.25)",
        "glow-lg": "0 0 80px rgba(34, 211, 238, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
