import type { Config } from "tailwindcss";

/**
 * Pixelle Motion Brand — Tailwind config.
 *
 * Tokens are mirrored from `docs/ai/specs/theme-ui-moi-pixelle-motion-brand.md`.
 * Keep the palette names stable: components across the app rely on
 * `bg-brand-primary-800`, `text-text-heading`, `from-gradient-text`, etc.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        // Navy — structural palette
        "brand-primary": {
          50: "#f4f7fb",
          100: "#e8eef7",
          200: "#cfd9ea",
          300: "#aebed8",
          400: "#7f94ba",
          500: "#526b98",
          600: "#31486f",
          700: "#23385a",
          800: "#1a2b4d",
          900: "#121f39",
        },
        // Gold — accent (signature start)
        "brand-gold": {
          300: "#efd39b",
          400: "#e2bd73",
          500: "#d4a853",
          600: "#c8953d",
          700: "#b8862e",
        },
        // Red — accent (signature end)
        "brand-red": {
          300: "#f6a3a3",
          400: "#ef6a6a",
          500: "#e53e3e",
          600: "#d63a39",
          700: "#c53030",
        },
        // Neutrals
        neutral: {
          0: "#ffffff",
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1f2937",
          900: "#0f172a",
        },
        // Semantic — used only for feedback states
        success: {
          DEFAULT: "#15803d",
          soft: "#dcfce7",
        },
        warning: {
          DEFAULT: "#b45309",
          soft: "#fef3c7",
        },
        error: {
          DEFAULT: "#dc2626",
          soft: "#fee2e2",
        },
        info: {
          DEFAULT: "#2563eb",
          soft: "#dbeafe",
        },
        // Convenience aliases per the spec's token mapping
        "bg-app": "var(--bg-app)",
        "bg-surface": "var(--bg-surface)",
        "bg-surface-subtle": "var(--bg-surface-subtle)",
        "text-heading": "var(--text-heading)",
        "text-body": "var(--text-body)",
        "text-muted": "var(--text-muted)",
        "border-default": "var(--border-default)",
        "ring-focus": "var(--ring-focus)",
      },
      fontFamily: {
        sans: [
          "Noto Sans JP",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        display: ["40px", { lineHeight: "48px", fontWeight: "700" }],
        h1: ["32px", { lineHeight: "40px", fontWeight: "700" }],
        h2: ["28px", { lineHeight: "36px", fontWeight: "700" }],
        h3: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        h4: ["20px", { lineHeight: "28px", fontWeight: "600" }],
        title: ["18px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "26px", fontWeight: "400" }],
        body: ["15px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "22px", fontWeight: "400" }],
        label: ["13px", { lineHeight: "20px", fontWeight: "500" }],
        caption: ["12px", { lineHeight: "18px", fontWeight: "500" }],
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px",
      },
      borderRadius: {
        DEFAULT: "8px",
        sm: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        "2xl": "16px",
        "3xl": "24px",
        pill: "999px",
      },
      boxShadow: {
        1: "0 1px 2px rgba(15, 23, 42, 0.05)",
        2: "0 8px 24px rgba(15, 23, 42, 0.08)",
        3: "0 18px 40px rgba(15, 23, 42, 0.12)",
        4: "0 24px 48px rgba(15, 23, 42, 0.16)",
        focus: "0 0 0 4px rgba(174, 190, 216, 0.5)",
      },
      backgroundImage: {
        "gradient-text": "linear-gradient(90deg, #d4a853 0%, #e53e3e 100%)",
        "gradient-cta": "linear-gradient(180deg, #d7ac38 0%, #ed3334 100%)",
        "gradient-surface-soft":
          "linear-gradient(135deg, rgba(26,43,77,0.04) 0%, rgba(212,168,83,0.10) 100%)",
      },
      backgroundSize: {
        "gradient-cta": "100% 100%",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        aurora: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
        drift: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        glow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.85" },
        },
        reveal: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "light-sweep": {
          "0%": { left: "-25%", opacity: "0" },
          "30%": { opacity: "1" },
          "70%": { opacity: "1" },
          "100%": { left: "125%", opacity: "0" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "0.2" },
          "50%": { opacity: "0.55" },
        },
        "float-panel": {
          "0%, 100%": {
            transform: "translateY(0px) rotate(0.5deg)",
          },
          "50%": {
            transform: "translateY(-8px) rotate(1deg)",
          },
        },
        "progress-shift": {
          "0%, 100%": { width: "40%" },
          "50%": { width: "58%" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        shimmer: "shimmer 1.6s linear infinite",
        aurora: "aurora 18s ease-in-out infinite alternate",
        drift: "drift 8s ease-in-out infinite",
        "drift-slow": "drift 14s ease-in-out infinite reverse",
        glow: "glow 6s ease-in-out infinite alternate",
        reveal: "reveal 0.6s ease-out forwards",
        "light-sweep": "light-sweep 8s ease-in-out infinite",
        "soft-pulse": "soft-pulse 4.5s ease-in-out infinite",
        "float-panel": "float-panel 7s ease-in-out infinite",
        "progress-shift": "progress-shift 5.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
