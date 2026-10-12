"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/**
 * Whether the home page's hero search is on screen. The header hides its own
 * search while it is, as on tokens.xyz, so the page never shows two.
 */
const Context = createContext<{ heroVisible: boolean; setHeroVisible: (v: boolean) => void }>({
  heroVisible: false,
  setHeroVisible: () => {},
});

export function SearchVisibilityProvider({ children }: { children: ReactNode }) {
  const [heroVisible, setHeroVisible] = useState(false);
  const value = useMemo(() => ({ heroVisible, setHeroVisible }), [heroVisible]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useSearchVisibility = () => useContext(Context);
