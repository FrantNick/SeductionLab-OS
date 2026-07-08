import type { Config } from "tailwindcss";

/**
 * Warm editorial brutalist design system — printed magazine meets
 * productivity tool. Light warm backgrounds, warm near-black ink,
 * rust accent, hard paper-cut shadows, no gradients or blurs.
 *
 * Every color reads a CSS variable (RGB triples defined in globals.css:
 * `:root` = light, `.dark` = the dark variant), so the whole app
 * re-themes at runtime from the sidebar toggle.
 *
 * The `ink`, `ember` and `zinc` scales are REMAPPED from the original
 * dark-SaaS theme so the hundreds of existing utility classes restyle
 * globally while keeping their visual hierarchy:
 *   ink-950…600  surfaces (950 = page paper, 600 = strong border)
 *   ember        accent → rust
 *   zinc-100…600 text hierarchy (lower = more prominent)
 * Status hues (emerald/red/amber/sky) map onto the pos/neg palette.
 */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const vt = (name: string, alpha: number) => `rgb(var(--${name}) / ${alpha})`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // semantic tokens
        paper: { DEFAULT: v("paper"), 2: v("paper-2") },
        card: v("card"),
        cream: "#FBF9F3", // fixed: text on ink/rust slabs in both themes
        line: { DEFAULT: v("text"), soft: v("line-soft") },
        rust: { DEFAULT: v("rust"), bright: v("rust-bright"), tint: v("rust-tint") },
        pos: { DEFAULT: v("pos"), tint: v("pos-tint") },
        neg: v("rust"),

        // remapped legacy surface scale
        ink: {
          DEFAULT: v("text"),
          2: vt("text", 0.65),
          3: vt("text", 0.42),
          950: v("paper"), //   page background
          900: v("paper-2"), // raised surfaces
          850: v("card"), //    cards
          800: v("hover"), //   hover surfaces / soft fills
          700: v("line-soft"), // subtle borders & dividers
          600: v("text"), //    strong borders (inputs, modals)
        },
        // remapped accent
        ember: {
          DEFAULT: v("rust"),
          hover: v("rust-bright"),
          soft: v("rust-tint"),
          text: v("rust"),
        },
        // remapped text scale (hierarchy preserved)
        zinc: {
          100: v("text"),
          200: v("text"),
          300: vt("text", 0.8),
          400: vt("text", 0.65),
          500: vt("text", 0.45),
          600: vt("text", 0.4),
        },
        // status hues → pos/neg (chart + badge palettes validated per theme)
        emerald: { 400: v("pos"), 500: v("pos") },
        red: { 300: v("rust-bright"), 400: v("rust"), 500: v("rust-bright"), 600: v("rust") },
        amber: { 400: v("rust"), 500: v("rust") },
        sky: { 400: v("info"), 500: v("info") },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Anton", "Archivo", "Inter", "sans-serif"],
        heading: ["Archivo", "Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        // hard paper-cut shadows — no blur, ever
        card: "6px 6px 0 rgb(var(--shadow))",
        pop: "6px 6px 0 rgb(var(--shadow))",
        hard: "6px 6px 0 rgb(var(--shadow))",
        "hard-sm": "4px 4px 0 rgb(var(--shadow))",
        focus: "0 0 0 3px rgb(var(--rust-tint)), 4px 4px 0 rgb(var(--shadow))",
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
