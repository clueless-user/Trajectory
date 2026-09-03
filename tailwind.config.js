/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: {
          base: "#09090b",       // deepest background
          subtle: "#121215",     // card/panel background
          muted: "#18181b",      // secondary elements
          border: "#27272a",     // subtle borders
          borderStrong: "#3f3f46"
        },
        text: {
          primary: "#f4f4f5",    // high-contrast primary text
          secondary: "#a1a1aa",  // secondary labels
          muted: "#71717a",      // timestamps, shortcuts, hints
        },
        trajectory: {
          cyan: "#06b6d4",
          blue: "#3b82f6",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
          purple: "#8b5cf6",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "Monaco", "monospace"],
      },
    },
  },
  plugins: [],
};
