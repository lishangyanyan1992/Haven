import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        foreground: "var(--color-text-primary)",
        card: "var(--color-surface)",
        border: "var(--color-border)",
        muted: "var(--color-surface-alt)",
        "muted-foreground": "var(--color-text-secondary)",
        accent: "var(--color-accent)",
        primary: "var(--haven-ink)",
        "primary-foreground": "var(--haven-cream)",
        haven: {
          ink: "var(--haven-ink)",
          "ink-mid": "var(--haven-ink-mid)",
          "ink-light": "var(--haven-ink-light)",
          sage: "var(--haven-sage)",
          "sage-mid": "var(--haven-sage-mid)",
          "sage-light": "var(--haven-sage-light)",
          sky: "var(--haven-sky)",
          "sky-mid": "var(--haven-sky-mid)",
          "sky-light": "var(--haven-sky-light)",
          blush: "var(--haven-blush)",
          "blush-light": "var(--haven-blush-light)",
          sand: "var(--haven-sand)",
          cream: "var(--haven-cream)"
        }
      },
      fontFamily: {
        sans: ["DM Sans", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        display: ["DM Serif Display", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"]
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0" }]
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px"
      },
      animation: {
        enter: "haven-fade-up 0.35s ease-out both"
      },
      keyframes: {
        "haven-fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
