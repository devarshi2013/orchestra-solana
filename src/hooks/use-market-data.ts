"use client";

import { useEffect, useState } from "react";

import { fetchMarketData } from "@/lib/api-client";
import type { MarketData } from "@/lib/symphony/market-data";

type State = { key: string; data?: MarketData; error?: string };

/** Stored daily closes for `mints`, refetched (debounced) when the set changes. */
export function useMarketData(mints: readonly string[], enabled = true) {
  const key = [...new Set(mints)].sort().join(",");
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (!enabled || !key) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchMarketData(key.split(","), controller.signal)
        .then((data) => setState({ key, data }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setState({ key, error: (error as Error).message });
        });
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, enabled]);

  const current = state?.key === key ? state : null;
  return { data: current?.data, error: current?.error, loading: enabled && !!key && !current };
}
