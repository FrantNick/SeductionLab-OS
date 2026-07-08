"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Runtime light/dark theming. The root layout runs a tiny pre-hydration
 * script that applies the persisted (or system-preferred) theme class to
 * <html> before paint, so there is no flash; this provider mirrors that
 * state into React and persists changes from the toggle.
 */

const STORAGE_KEY = "sl-theme";

const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({
  dark: false,
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // read the class the pre-hydration script already applied
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = useCallback(() => {
    setDark((current) => {
      const next = !current;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
      } catch {
        // private mode — theme just won't persist
      }
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ dark, toggle }}>{children}</ThemeContext.Provider>;
}

/** Pill toggle used in the sidebar rail and the mobile top bar. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { dark, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border-brutal border-line bg-card font-mono uppercase tracking-[0.06em] text-ink-2 transition-colors hover:text-ink ${
        compact ? "h-9 w-9 text-sm" : "w-full px-3 py-1.5 text-[10.5px]"
      }`}
    >
      <span aria-hidden>{dark ? "☾" : "☀"}</span>
      {!compact && (dark ? "Dark theme" : "Light theme")}
    </button>
  );
}
