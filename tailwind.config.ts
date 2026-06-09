import type { Config } from "tailwindcss";

/**
 * Tailwind is wired to the semantic token layer in `styles/tokens.css`.
 * Components reference these semantic utilities (e.g. `bg-surface`, `text-muted`,
 * `border-border`) — NEVER raw hex. Both `:root` (light) and `[data-theme="dark"]`
 * resolve the same CSS variables, so utilities repaint on theme toggle for free.
 */
const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // surfaces & canvas
        bg: "var(--bg)",
        "bg-store": "var(--bg-store)",
        surface: "var(--surface)",
        "surface-subtle": "var(--surface-subtle)",
        "surface-sunken": "var(--surface-sunken)",
        // borders
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        // text
        text: "var(--text)",
        "text-strong": "var(--text-strong)",
        "text-muted": "var(--text-muted)",
        "text-on-accent": "var(--text-on-accent)",
        // accent (action color ONLY — never a status color)
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-pressed": "var(--accent-pressed)",
        "accent-tint": "var(--accent-tint)",
        // functional status colors
        success: "var(--success)",
        "success-bg": "var(--success-bg)",
        warning: "var(--warning)",
        "warning-bg": "var(--warning-bg)",
        critical: "var(--critical)",
        "critical-bg": "var(--critical-bg)",
        info: "var(--info)",
        "info-bg": "var(--info-bg)",
      },
      ringColor: {
        DEFAULT: "var(--focus-ring)",
        focus: "var(--focus-ring)",
      },
      fontFamily: {
        ui: "var(--font-ui)",
        mono: "var(--font-mono)",
        display: "var(--font-display)",
        sans: "var(--font-ui)",
      },
      fontSize: {
        "2xs": "var(--text-2xs)",
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        md: "var(--text-md)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
        "4xl": "var(--text-4xl)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
        16: "var(--space-16)",
        20: "var(--space-20)",
        24: "var(--space-24)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        out: "var(--ease-out)",
      },
      transitionDuration: {
        fast: "120ms",
        base: "180ms",
        slow: "260ms",
      },
    },
  },
  plugins: [],
};

export default config;
