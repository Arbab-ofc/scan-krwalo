import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#f7faf9",
        panel: "#ffffff",
        line: "#dbe5e2",
        accent: "#0fbf9f",
        lime: "#84cc16",
        ink: "#10201d"
      },
      boxShadow: {
        glow: "0 20px 60px rgba(15, 191, 159, 0.14)"
      }
    }
  },
  plugins: []
};

export default config;
