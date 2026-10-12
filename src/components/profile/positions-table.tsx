"use client";

import { Change } from "@/components/market/change";
import { formatPrice } from "@/components/market/format";
import { TokenLogo } from "@/components/market/token-logo";
import { RollText } from "@/components/motion";
import { cn } from "@/lib/utils";

import { HIDDEN, qty, signedUsd, tone, usd } from "./format";
import type { ValuedPosition } from "./summary";

const HEAD = "pb-2.5 text-[12.5px] font-medium text-ink-muted";

/** Holdings, most valuable first; a row opens its position sheet. */
export function PositionsTable({
  rows,
  stale,
  hidden,
  onOpen,
}: {
  rows: ValuedPosition[];
  stale: boolean;
  hidden: boolean;
  onOpen: (mint: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-14 text-center text-[13.5px] text-ink-muted">No stock tokens</p>;
  }
  return (
    <>
      <ul className="divide-y divide-border-extra-light border-t border-border-light md:hidden">
        {rows.map((r) => (
          <li key={r.mint}>
            <button
              type="button"
              onClick={() => onOpen(r.mint)}
              className="flex w-full cursor-pointer items-center gap-3 py-3.5 text-left tabular-nums"
            >
              <TokenLogo src={r.icon} symbol={r.symbol} className="size-9" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-text-extra-high">
                  {r.symbol}
                </span>
                <span className="block text-[12.5px] text-ink-muted">
                  {hidden ? HIDDEN : `${qty(r.tokenAmount)} · ${formatPrice(r.price)}`}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[15px] font-medium text-text-extra-high">
                  {hidden ? HIDDEN : r.value == null ? "—" : usd(r.value)}
                </span>
                {r.pnl == null ? (
                  <span className="block text-[12.5px] text-ink-muted">—</span>
                ) : (
                  <span className={cn("block text-[12.5px] font-medium", tone(r.pnl))}>
                    {hidden ? HIDDEN : signedUsd(r.pnl)}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-[14px] tracking-[-0.01em] tabular-nums">
          <thead>
            <tr className="text-left">
              <th className={HEAD}>Token</th>
              <th className={cn(HEAD, "text-right")}>Price</th>
              <th className={cn(HEAD, "text-right")}>24h</th>
              <th className={cn(HEAD, "text-right")}>Holdings</th>
              <th className={cn(HEAD, "text-right")}>Avg cost</th>
              <th className={cn(HEAD, "pr-1 text-right")}>P&amp;L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-extra-light border-t border-border-light">
            {rows.map((r) => (
              <tr
                key={r.mint}
                tabIndex={0}
                onClick={() => onOpen(r.mint)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen(r.mint)}
                className="h-16 cursor-pointer transition-colors hover:bg-soft/60 focus-visible:bg-soft/60 focus-visible:outline-none"
              >
                <td>
                  <span className="flex items-center gap-2.5">
                    <TokenLogo src={r.icon} symbol={r.symbol} className="size-8" />
                    <span className="min-w-0">
                      <span className="block font-semibold text-text-extra-high">{r.symbol}</span>
                      <span className="block max-w-[220px] truncate text-[12.5px] text-ink-muted">
                        {r.name}
                      </span>
                    </span>
                  </span>
                </td>
                <td className={cn("text-right", stale ? "text-ink-muted" : "text-text-high")}>
                  {r.price == null ? "—" : <RollText value={formatPrice(r.price)} />}
                </td>
                <td className="text-right">
                  <Change pct={r.change24h} />
                </td>
                <td className="text-right">
                  <span className="block font-medium text-text-extra-high">
                    {hidden ? HIDDEN : r.value == null ? "—" : <RollText value={usd(r.value)} />}
                  </span>
                  <span className="block text-[12.5px] text-ink-muted">
                    {hidden ? HIDDEN : `${qty(r.tokenAmount)} ${r.symbol}`}
                  </span>
                </td>
                <td className="text-right text-text-high">{formatPrice(r.avgCost)}</td>
                <td className="pr-1 text-right">
                  {r.pnl == null ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <>
                      <span className={cn("block font-medium", tone(r.pnl))}>
                        {hidden ? HIDDEN : <RollText value={signedUsd(r.pnl)} />}
                      </span>
                      <Change pct={r.pnlPct} className="text-[12.5px]" tone="accent" />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
