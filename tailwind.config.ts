import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Premium dark SaaS palette
        ink: {
          950: "#0A0A0B", // page background (near-black)
          900: "#111113", // raised surfaces
          850: "#17171A", // cards
          800: "#1E1E22", // elevated cards / hovers
          700: "#2A2A30", // borders
          600: "#3A3A42", // strong borders
        },
        ember: {
          DEFAULT: "#C94B2C", // burnt orange accent
          hover: "#E05A38",
          soft: "#C94B2C1F",
          text: "#F0764F",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 1px 3px 0 rgba(0,0,0,0.5)",
        pop: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
