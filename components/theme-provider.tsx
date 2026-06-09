"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "offshelf-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applies the theme by setting `data-theme` on <html>; every token resolves off
 * that attribute, so the whole UI repaints from the CSS-variable layer.
 * Preference persists to localStorage. A blocking inline script in the root layout
 * (`themeInitScript`) sets the attribute before first paint to avoid a flash.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Hydrate from the attribute the inline script already set (or storage).
  useEffect(() => {
    const fromAttr = document.documentElement.getAttribute("data-theme") as Theme | null;
    const stored = (() => {
      try {
        return localStorage.getItem(STORAGE_KEY) as Theme | null;
      } catch {
        return null;
      }
    })();
    setThemeState(fromAttr ?? stored ?? "light");
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore (private mode / SSR) */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/**
 * Blocking script injected in <head> to set `data-theme` from saved preference
 * (falling back to OS preference) before the page paints — prevents a light/dark
 * flash on load. Kept dependency-free and tiny.
 */
export const themeInitScript = `
(function(){try{
  var k="${STORAGE_KEY}";
  var t=localStorage.getItem(k);
  if(t!=="light"&&t!=="dark"){
    t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  }
  document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","light");}})();
`;
