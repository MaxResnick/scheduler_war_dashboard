import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        anza: {
          bg: "rgb(var(--anza-bg) / <alpha-value>)",
          surface: "rgb(var(--anza-surface) / <alpha-value>)",
          "surface-alt": "rgb(var(--anza-surface-alt) / <alpha-value>)",
          border: "rgb(var(--anza-border) / <alpha-value>)",
          green: "rgb(var(--anza-green) / <alpha-value>)",
          "green-dark": "rgb(var(--anza-green-dark) / <alpha-value>)",
          "green-mid": "rgb(var(--anza-green-mid) / <alpha-value>)",
          "green-muted": "rgb(var(--anza-green-muted) / <alpha-value>)",
          "green-subtle": "rgb(var(--anza-green-subtle) / <alpha-value>)"
        }
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Oxygen",
          "Ubuntu",
          "Cantarell",
          "Fira Sans",
          "Droid Sans",
          "Helvetica Neue",
          "sans-serif"
        ],
        mono: [
          "SF Mono",
          "Monaco",
          "Inconsolata",
          "Fira Mono",
          "Droid Sans Mono",
          "Source Code Pro",
          "monospace"
        ]
      },
      animation: {
        shimmer: "shimmer 2s infinite linear"
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" }
        }
      }
    }
  },
  plugins: []
};

export default config;
