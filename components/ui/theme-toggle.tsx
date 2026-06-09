"use client";

import { useTheme } from "@/components/theme-provider";
import { Icon } from "@/components/ui/icon";

/**
 * Light/dark toggle. Lives in the admin topbar (Stage 2) and the kitchen sink.
 * Shows the icon for the theme you'd switch TO; fully keyboard-operable.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-border " +
        "text-text-muted transition-colors duration-fast ease-standard " +
        "hover:bg-surface-subtle hover:text-text " +
        (className ?? "")
      }
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}
