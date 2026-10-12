"use client";

import { useEffect, useState } from "react";

import { usePageVisible } from "@/hooks/use-page-visible";
import { pricesApi } from "@/lib/api-client";
import type { PricesResponse } from "@/lib/strategies/types";

export type LivePrices = {
  prices: PricesResponse["prices"];
  /** When the shown prices were read; null before the first read. */
  asOf: string | null;
  /** Set when the latest refresh failed: the prices shown are from `asOf`, not now. */
  stale: boolean;
};

const EMPTY: LivePrices = { prices: {}, asOf: null, stale: false };

/**
 * Jupiter's live price for each mint, read every `ms` while the tab is
 * visible. A failed refresh keeps the last prices but marks them stale, so
 * they're never shown as current.
 */
export function useLivePrices(mints: readonly string[], ms = 5_000): LivePrices {
  const visible = usePageVisible();
  const key = [...new Set(mints)].sort().join(",");
  const [state, setState] = useState<{ key: string } & LivePrices>({ key: "", ...EMPTY });
  const current = state.key === key ? state : { key, ...EMPTY };

  useEffect(() => {
    if (!key || !visible) return;
    let live = true;
    const load = () =>
      pricesApi
        .get(key.split(","))
        .then(({ prices, asOf }) => live && setState({ key, prices, asOf, stale: false }))
        .catch((e: unknown) => {
          if (!live) return;
          console.error("[prices] refresh failed", e);
          setState((s) => (s.key === key ? { ...s, stale: true } : { key, ...EMPTY, stale: true }));
        });
    void load();
    const timer = window.setInterval(load, ms);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [key, ms, visible]);

  return { prices: current.prices, asOf: current.asOf, stale: current.stale };
}
