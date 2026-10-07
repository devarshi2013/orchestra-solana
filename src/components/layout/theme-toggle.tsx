"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

type Theme = "system" | "light" | "dark";
export const THEME_KEY = "orchestra-theme";

/** Runs in <head> before paint so the page never flashes the wrong theme. */
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}`;

const read = (): Theme => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
};

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};
/** Cycles system → light → dark. "System" follows the OS setting live. */
export function ThemeToggle() {
  // "system" while server rendering; the stored choice once hydrated.
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={() => {
        const next = NEXT[theme];
        try {
          if (next === "system") localStorage.removeItem(THEME_KEY);
          else localStorage.setItem(THEME_KEY, next);
        } catch {
          // Storage blocked: still switch for this page view.
        }
        apply(next);
        listeners.forEach((l) => l());
      }}
      aria-label={`${LABEL[theme]} (switch to ${LABEL[NEXT[theme]].toLowerCase()})`}
      title={LABEL[theme]}
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
