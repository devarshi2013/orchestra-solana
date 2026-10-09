"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
export const THEME_KEY = "askfirst-theme";

/**
 * Runs in <head> before paint. The page is server-rendered dark (the default);
 * this only switches to light when the visitor chose it, so there's no flash.
 */
export const themeScript = `try{if(localStorage.getItem("${THEME_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}`;

const read = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Switches between dark (the default) and light, remembered in this browser. */
export function ThemeToggle() {
  // Dark while server rendering; the stored choice once hydrated.
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={() => {
        try {
          localStorage.setItem(THEME_KEY, next);
        } catch {
          // Storage blocked: still switch for this page view.
        }
        document.documentElement.classList.toggle("dark", next === "dark");
        listeners.forEach((l) => l());
      }}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
