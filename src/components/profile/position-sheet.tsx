"use client";

import { ArrowUpRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Change } from "@/components/market/change";
import { formatPrice } from "@/components/market/format";
import { TokenLogo } from "@/components/market/token-logo";
import { TradePanel } from "@/components/markets/trade-panel";
import { RollText } from "@/components/motion";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useStock } from "@/hooks/use-markets";
import { solscanTxUrl } from "@/lib/solana";
import type { StockToken } from "@/lib/stocks/types";
import type { Fill } from "@/lib/strategies/types";
import { cn } from "@/lib/utils";

import { dateTime, HIDDEN, qty, signedUsd, tone, usd } from "./format";
import type { ValuedPosition } from "./summary";

/** One holding in a side sheet: its figures, its recorded trades, and a trade ticket. */
export function PositionSheet({
  position,
  fills,
  hidden,
  onClose,
}: {
  position: ValuedPosition | null;
  fills: Fill[];
  hidden: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={position != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[460px] data-[side=right]:sm:max-w-[460px]"
      >
        {position && (
          <Body
            position={position}
            fills={fills.filter((f) => f.mint === position.mint)}
            hidden={hidden}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({
  position: p,
  fills,
  hidden,
}: {
  position: ValuedPosition;
  fills: Fill[];
  hidden: boolean;
}) {
  const figure = (n: number | null, fmt: (n: number) => string) =>
    hidden ? HIDDEN : n == null ? "—" : fmt(n);
  const stats = [
    { label: "Value", value: figure(p.value, usd) },
    { label: "Holdings", value: hidden ? HIDDEN : `${qty(p.tokenAmount)} ${p.symbol}` },
    { label: "Avg cost", value: formatPrice(p.avgCost) },
    { label: "Cost basis", value: figure(p.costBasis, usd) },
  ];

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 px-6 pt-6 pb-5">
        <TokenLogo src={p.icon} symbol={p.symbol} className="size-11" />
        <div className="min-w-0 flex-1">
          <SheetTitle className="text-[17px] font-semibold tracking-[-0.01em]">
            {p.symbol}
          </SheetTitle>
          <SheetDescription className="truncate text-[13px] text-ink-muted">
            {p.name}
          </SheetDescription>
        </div>
        <Link
          href={`/stocks/${encodeURIComponent(p.ticker)}`}
          className="mr-8 inline-flex items-center gap-1 text-[13px] font-medium text-text-medium hover:text-text-extra-high"
        >
          Stock page <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      </header>

      <div className="px-6">
        <p className="text-[12.5px] text-ink-muted">Unrealized P&amp;L</p>
        <div className="mt-1 flex items-baseline gap-3">
          <p
            className={cn(
              "text-[32px] leading-none font-semibold tracking-[-0.02em] tabular-nums",
              tone(p.pnl),
            )}
          >
            {p.pnl == null ? "—" : hidden ? HIDDEN : <RollText value={signedUsd(p.pnl)} />}
          </p>
          <Change pct={p.pnlPct} tone="accent" className="text-[14px] font-medium" />
        </div>
        <dl className="mt-5 grid grid-cols-2 overflow-hidden rounded-[16px] bg-soft">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn(
                "px-4 py-3",
                i % 2 === 1 && "border-l border-white",
                i > 1 && "border-t border-white",
              )}
            >
              <dt className="text-[12px] text-ink-muted">{s.label}</dt>
              <dd className="mt-0.5 text-[15px] font-medium text-text-extra-high tabular-nums">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <Trade ticker={p.ticker} mint={p.mint} />

      <section className="px-6 pt-2 pb-8">
        <h3 className="pb-2 text-[13px] font-medium text-ink-muted">Trades</h3>
        {fills.length === 0 ? (
          <p className="text-[13.5px] text-ink-muted">None recorded</p>
        ) : (
          <ul className="divide-y divide-border-extra-light border-t border-border-light">
            {fills.map((f) => (
              <li key={f.signature} className="flex items-center gap-3 py-3 tabular-nums">
                <span
                  className={cn(
                    "w-9 text-[12.5px] font-medium capitalize",
                    f.side === "buy" ? "text-emerald-700" : "text-red-700",
                  )}
                >
                  {f.side}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-text-extra-high">
                    {usd(f.usdcAmount)}
                    <span className="text-ink-muted"> @ {formatPrice(f.price)}</span>
                  </span>
                  <span className="block text-[12px] text-ink-muted">{dateTime(f.blockTime)}</span>
                </span>
                <a
                  href={solscanTxUrl(f.signature, "mainnet-beta")}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View on Solscan"
                  className="text-ink-muted hover:text-text-extra-high"
                >
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** The stock page's trade ticket, on this position's token. */
function Trade({ ticker, mint }: { ticker: string; mint: string }) {
  const stock = useStock(ticker);
  const [picked, setPicked] = useState<StockToken | null>(null);
  const data = stock.data?.stock;
  const token = picked ?? data?.tokens.find((t) => t.mint === mint) ?? null;
  return (
    <div className="px-6 py-6">
      {data && token ? (
        <TradePanel stock={data} token={token} onTokenChange={setPicked} />
      ) : (
        <div className="h-48 animate-pulse rounded-[20px] bg-soft" aria-busy>
          {stock.error && (
            <p className="flex h-full items-center justify-center text-[13px] text-status-error-text">
              {stock.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
