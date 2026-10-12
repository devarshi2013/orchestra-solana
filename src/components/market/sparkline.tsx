"use client";

import { useEffect, useRef, useState } from "react";

import { useStockHistory } from "@/hooks/use-markets";
import { cn } from "@/lib/utils";

const UP = "#10b981";
const DOWN = "#ef4444";

/**
 * A token's last 24 hours as one quiet line, green when it ended up, red when
 * down. It loads once it scrolls into view; with no pool history it says so.
 */
export function Sparkline({ mint, className }: { mint: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setSeen(true), {
      rootMargin: "200px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen]);

  const history = useStockHistory(seen ? mint : null, "24h");
  const closes = (history.data?.candles ?? []).map((c) => c.close);
  const lo = Math.min(...closes);
  const span = Math.max(...closes) - lo || 1;
  // A 100 × 40 viewBox, stretched to the box; 2 units of padding top and bottom.
  const path = closes
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${((i / (closes.length - 1)) * 100).toFixed(2)} ${(38 - ((v - lo) / span) * 36).toFixed(2)}`,
    )
    .join("");

  return (
    <div ref={ref} className={cn("relative", className)}>
      {history.error && !history.data ? (
        <p className="flex h-full items-center justify-center text-xs text-text-low">
          Chart unavailable
        </p>
      ) : history.data && closes.length < 2 ? (
        <p className="flex h-full items-center justify-center text-xs text-text-low">
          No chart data
        </p>
      ) : closes.length > 1 ? (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
          <path
            d={path}
            fill="none"
            stroke={closes.at(-1)! < closes[0]! ? DOWN : UP}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-gray-50" aria-busy />
      )}
    </div>
  );
}
