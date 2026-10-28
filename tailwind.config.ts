import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1B2631",      // graphite text
        navy: { DEFAULT: "#12324A", 700: "#0E2638", 50: "#E8EEF3" },
        steel: "#52606D",    // secondary text
        sheet: "#F3F5F4",    // drawing-sheet background
        line: "#C9D1D5",     // rules and borders
        amber: { DEFAULT: "#E3A008", 700: "#B07D00" },
        ok: "#1E7B4F",
        warn: "#9A6700",
        danger: "#B3261E",
      },
      fontFamily: {
        // Bahnschrift (Windows) has a DIN-like, engineering-drawing character; others fall back cleanly.
        sans: ["Bahnschrift", "'Segoe UI'", "system-ui", "-apple-system", "Roboto", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      maxWidth: { page: "72rem" },
    },
  },
  plugins: [],
};
export default config;
