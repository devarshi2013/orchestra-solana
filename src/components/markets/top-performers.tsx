import Link from "next/link";

import { TokenLogo } from "@/components/market/token-logo";
import { formatPrice } from "@/lib/market/series";
import type { MarketRow } from "@/lib/markets/types";

import { ChangeText } from "./live-number";

/** The biggest 24h gainers, as small cards linking to their stock page. */
export function TopPerformers({ rows }: { rows: MarketRow[] }) {
  const top = rows
    .filter((r) => r.change24h !== null && r.change24h > 0 && r.price !== null)
    .sort((a, b) => b.change24h! - a.change24h!)
    .slice(0, 4);
  if (top.length === 0) return null;
  return (
    <section aria-labelledby="top-heading" className="space-y-3">
      <h2 id="top-heading" className="text-sm font-semibold text-muted-foreground">
        Top performers · 24h
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {top.map((r) => (
          <li key={r.ticker}>
            <Link
              href={`/markets/${r.ticker}`}
              className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 transition-[transform,background-color] duration-300 ease-out outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring motion-safe:hover:-translate-y-0.5"
            >
              <TokenLogo src={r.icon} symbol={r.ticker} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold group-hover:text-white">
                  {r.ticker}
                </span>
                <span className="block font-mono text-xs text-muted-foreground tabular-nums">
                  {formatPrice(r.price!)}
                </span>
              </span>
              <ChangeText value={r.change24h} className="text-sm" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
