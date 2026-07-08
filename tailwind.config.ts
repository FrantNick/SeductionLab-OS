import type { Config } from "tailwindcss";

/**
 * Warm editorial brutalist design system — printed magazine meets
 * productivity tool. Light warm backgrounds, warm near-black ink,
 * rust accent, hard paper-cut shadows, no gradients or blurs.
 *
 * The `ink`, `ember` and `zinc` scales are REMAPPED from the previous
 * dark theme so the hundreds of existing utility classes restyle
 * globally while keeping their visual hierarchy:
 *   ink-950…600  dark surfaces → warm light surfaces (950 = page paper)
 *   ember        orange accent → rust
 *   zinc-100…600 light-on-dark text → dark-on-light ink tints
 * Status hues (emerald/red/amber/sky) map onto the pos/neg palette.
 */
const INK = "#1C1714";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // semantic tokens
        paper: { DEFAULT: "#F4F0E7", 2: "#FAF2EC" },
        card: "#FBF9F3",
        cream: "#FBF9F3",
        line: { DEFAULT: INK, soft: "#D8D1C2" },
        rust: { DEFAULT: "#C75230", bright: "#E0532C", tint: "#F6E6DD" },
        pos: { DEFAULT: "#2F6E4F", tint: "#E4EFE7" },
        neg: "#C75230",

        // remapped legacy surface scale (was dark ink, now warm paper)
        ink: {
          DEFAULT: INK,
          2: "rgba(28,23,20,0.65)",
          3: "rgba(28,23,20,0.42)",
          950: "#F4F0E7", // page background (paper)
          900: "#FAF2EC", // raised surfaces
          850: "#FBF9F3", // cards
          800: "#ECE7DA", // hover surfaces / soft fills
          700: "#D8D1C2", // subtle borders & dividers (line-soft)
          600: INK, //        strong borders (inputs, modals)
        },
        // remapped accent (was ember orange on dark, now rust on light)
        ember: {
          DEFAULT: "#C75230",
          hover: "#E0532C",
          soft: "#F6E6DD",
          text: "#C75230",
        },
        // remapped text scale (hierarchy preserved: lower = more prominent)
        zinc: {
          100: INK,
          200: INK,
          300: "rgba(28,23,20,0.8)",
          400: "rgba(28,23,20,0.65)", // ink-2
          500: "rgba(28,23,20,0.42)", // ink-3
          600: "rgba(28,23,20,0.4)",
        },
        // status hues → design-system pos/neg (validated on card surface)
        emerald: { 400: "#2F6E4F", 500: "#2F6E4F" },
        red: { 300: "#E0532C", 400: "#C75230", 500: "#E0532C", 600: "#C75230" },
        amber: { 400: "#C75230", 500: "#C75230" },
        sky: { 400: "#3172BE", 500: "#3172BE" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Anton", "Archivo", "Inter", "sans-serif"],
        heading: ["Archivo", "Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        // hard paper-cut shadows — no blur, ever
        card: `6px 6px 0 ${INK}`,
        pop: `6px 6px 0 ${INK}`,
        hard: `6px 6px 0 ${INK}`,
        "hard-sm": `4px 4px 0 ${INK}`,
        focus: `0 0 0 3px #F6E6DD, 4px 4px 0 ${INK}`,
      },
      borderWidth: {
        DEFAULT: "1px",
        brutal: "1.75px",
      },
      borderRadius: {
        brutal: "4px",
        "brutal-lg": "8px",
      },
    },
  },
  plugins: [],
};

export default config;
