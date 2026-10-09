"use client";

import { useSyncExternalStore } from "react";

/** "dark" or "light", following the class the theme toggle sets on <html>. */
export function useResolvedTheme(): "dark" | "light" {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => observer.disconnect();
    },
    () => (document.documentElement.classList.contains("dark") ? "dark" : "light"),
    () => "light",
  );
}
