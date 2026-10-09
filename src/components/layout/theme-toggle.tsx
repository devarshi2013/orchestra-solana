"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";
/** Storage keys keep their pre-rebrand names, so saved preferences and chats carry over. */
export const THEME_KEY = "askfirst-theme";

/**
 * Runs in <head> before paint. The page is server-rendered light (the
 * default); this switches to dark only when the visitor chose it, so there's
 * no flash.
 */
export const themeScript = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;

const read = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Switches between light (the default) and dark, remembered in this browser. */
export function ThemeToggle() {
  // Light while server rendering; the stored choice once hydrated.
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
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
      className="inline-flex size-9 items-center justify-center rounded-lg text-primary-text transition-colors duration-150 hover:bg-primary/8 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-95"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
