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
        // Extend Tailwind's default zinc scale with the intermediate shades
        // the UI was already using (they previously resolved to nothing).
        zinc: {
          750: "#333338",
          850: "#1f1f23",
        },
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
      keyframes: {
        fadeIn: {
          "from": { opacity: "0", transform: "scale(0.98)" },
          "to": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 150ms ease-out",
      },
    },
  },
  plugins: [],
};
