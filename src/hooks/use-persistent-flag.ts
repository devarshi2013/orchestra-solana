"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Values set this page view (used when storage refuses them). */
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const read = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

/**
 * A yes/no preference remembered in this browser (false while server
 * rendering, and when storage is blocked; then it lasts for the page view).
 */
export function usePersistentFlag(key: string): [boolean, (value: boolean) => void] {
  const stored = useSyncExternalStore(
    subscribe,
    () => memory.get(key) ?? read(key),
    () => false,
  );
  const set = useCallback(
    (value: boolean) => {
      memory.set(key, value);
      try {
        localStorage.setItem(key, value ? "1" : "0");
      } catch {
        // Storage blocked: remembered in memory for this page view only.
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [stored, set];
}
