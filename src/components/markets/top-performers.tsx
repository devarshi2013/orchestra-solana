import Link from "next/link";

import { GradientCard } from "@/components/design/effects";
import { TokenLogo } from "@/components/market/token-logo";
import { formatPrice } from "@/lib/market/series";
import type { MarketRow } from "@/lib/markets/types";

import { ChangePill } from "./live-number";

/** The biggest 24h gainers, as small cards linking to their stock page. */
export function TopPerformers({ rows }: { rows: MarketRow[] }) {
  const top = rows
    .filter((r) => r.change24h !== null && r.change24h > 0 && r.price !== null)
    .sort((a, b) => b.change24h! - a.change24h!)
    .slice(0, 4);
  if (top.length === 0) return null;
  return (
    <section aria-labelledby="top-heading" className="space-y-3">
      <h2
        id="top-heading"
        className="font-mono text-xs font-medium tracking-[0.16em] text-label-blue uppercase"
      >
        Top performers · 24h
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {top.map((r) => (
          <li key={r.ticker}>
            <GradientCard className="h-full">
              <Link
                href={`/markets/${r.ticker}`}
                className="relative flex h-full flex-col gap-3 rounded-[inherit] p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center"
              >
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <TokenLogo src={r.icon} symbol={r.ticker} className="size-9 ring-1 ring-border" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium transition-colors duration-200 group-hover:text-white">
                      {r.name}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground tabular-nums">
                      {r.ticker} · {formatPrice(r.price!)}
                    </span>
                  </span>
                </span>
                <ChangePill value={r.change24h} className="self-start sm:self-auto" />
              </Link>
            </GradientCard>
          </li>
        ))}
      </ul>
    </section>
  );
}
