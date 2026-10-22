"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

export type HeroTheme = "dark" | "light";

const STORAGE_KEY = "sw-hero-theme";
const listeners = new Set<() => void>();

function readTheme(): HeroTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function writeTheme(theme: HeroTheme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  // Keeps other open tabs in step.
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

/** Hero surface choice, persisted in localStorage. Server render and first paint are always dark. */
export function useHeroTheme(): [HeroTheme, (theme: HeroTheme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as const);
  return [theme, writeTheme];
}

export function HeroThemeToggle({
  theme,
  onChange,
}: {
  theme: HeroTheme;
  onChange: (theme: HeroTheme) => void;
}) {
  const next = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      className="sw-hero-theme"
      aria-label={`Switch hero to ${next} theme`}
      onClick={() => onChange(next)}
    >
      <Icon aria-hidden size={18} strokeWidth={2} />
    </button>
  );
}
