"use client";

import { useNow } from "@/hooks/use-now";
import { usMarketSession } from "@/lib/assistant/market-hours";
import { cn } from "@/lib/utils";

const LABELS = {
  weekend: "Closed (weekend)",
  holiday: "Closed (US holiday)",
  "pre-market": "Pre-market",
  "after-hours": "After-hours",
} as const;

/**
 * Whether the US stock market is open right now (regular session, US Eastern
 * time), with a note that tokens still trade but liquidity can be thinner
 * when it's closed. Nothing shows until the browser knows the time.
 */
export function MarketHoursBadge({ className }: { className?: string }) {
  const now = useNow();
  if (now === 0) return null;
  const session = usMarketSession(new Date(now));
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono font-medium",
          session.open ? "border-gain/40 text-gain" : "text-foreground",
        )}
      >
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", session.open ? "bg-gain" : "bg-muted-foreground")}
        />
        US market: {session.open ? "Open" : LABELS[session.reason]}
      </span>
      {!session.open && (
        <span>Tokens still trade, but liquidity can be thinner while US markets are closed.</span>
      )}
    </p>
  );
}
