"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

/** True while the tab is visible (polling pauses when it's hidden). */
export const usePageVisible = () =>
  useSyncExternalStore(
    subscribe,
    () => document.visibilityState === "visible",
    () => true,
  );
