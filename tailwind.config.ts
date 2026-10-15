import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#07090E",
        panel: "#0C1018",
        anchor: "#FF2A4B",
        diode: "#00F0FF",
        mute: "#8B97A8",
      },
      fontFamily: {
        sans: [
          "PingFang SC",
          "Noto Sans SC",
          "SF Pro Text",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: ["SF Mono", "ui-monospace", "Menlo", "monospace"],
      },
      boxShadow: {
        lock: "0 0 24px rgba(255, 42, 75, 0.35)",
        diode: "0 0 18px rgba(0, 240, 255, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
