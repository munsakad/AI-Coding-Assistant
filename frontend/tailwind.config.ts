import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        base: "#0B0E14", // near-black editor background
        panel: "#131722",
        line: "#232838",
        accent: { DEFAULT: "#22D3A6", dark: "#17A87F" }, // terminal-green accent
        ink: "#E4E7EC",
        muted: "#8A94A6",
        ok: "#22D3A6",
        warn: "#F5A623",
        danger: "#F0546A",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { DEFAULT: "8px", lg: "12px" },
    },
  },
  plugins: [],
};
export default config;
