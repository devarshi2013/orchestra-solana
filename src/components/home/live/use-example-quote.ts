"use client";

import { useEffect, useState } from "react";

import { getJson } from "@/hooks/use-markets";
import type { ExampleQuote } from "@/lib/markets/types";

const REFRESH_MS = 30_000;

/**
 * A REAL Jupiter /order quote for 10 USDC of NVDA (no taker: pricing only,
 * nothing that could be signed), refreshed every 30 s while the tab is visible.
 * `failed` is true only when there is no quote to show at all.
 */
export function useExampleQuote(): { quote: ExampleQuote | null; failed: boolean } {
  const [quote, setQuote] = useState<ExampleQuote | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    const load = () => {
      if (document.visibilityState !== "visible") return;
      getJson<ExampleQuote>("/api/markets/example-quote", abort.signal)
        .then((q) => {
          setQuote(q);
          setFailed(false);
        })
        .catch((e: unknown) => {
          if (abort.signal.aborted) return;
          console.error("[home] example quote failed", e);
          setFailed(true);
        });
    };
    load();
    const id = window.setInterval(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
      abort.abort();
    };
  }, []);

  return { quote, failed: failed && !quote };
}
