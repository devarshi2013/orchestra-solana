"use client";

import { ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatBaseUnits } from "@/lib/amount";
import { formatUsd } from "@/lib/backtest/format";
import type { IndicativeQuote, LegView } from "@/lib/invest/views";
import { solscanTxUrl } from "@/lib/solana";
import { describePriceImpact } from "@/lib/swap/quote";
import { USDC_MINT } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const STATUS: Record<LegView["status"], { label: string; className: string }> = {
  pending: { label: "Waiting", className: "" },
  quoted: { label: "Awaiting signature", className: "text-amber-700 dark:text-amber-400" },
  executing: { label: "Sending", className: "text-amber-700 dark:text-amber-400" },
  succeeded: { label: "Done", className: "text-emerald-700 dark:text-emerald-400" },
  failed: { label: "Failed", className: "text-destructive" },
  skipped: { label: "Skipped", className: "text-muted-foreground" },
};

/**
 * One row per swap: what was planned, the quote to sign (expected output,
 * price impact, fee) and, once done, what actually moved and at what price.
 */
export function LegTable({
  legs,
  quotes,
  symbolOf,
  activeIndex,
  activeStep,
}: {
  legs: readonly LegView[];
  quotes?: ReadonlyMap<number, IndicativeQuote>;
  symbolOf: (mint: string) => string;
  activeIndex?: number;
  activeStep?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Swap</th>
            <th className="px-3 py-2 text-right font-medium">Planned</th>
            <th className="px-3 py-2 font-medium">Expected / actual</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg) => {
            const quote = leg.quote ?? quoteFor(quotes, leg.index);
            const decimals = quote?.decimals;
            const outSymbol = symbolOf(leg.outputMint);
            const outDecimals = leg.outputMint === USDC_MINT ? 6 : decimals;
            const active = activeIndex === leg.index;
            return (
              <tr key={leg.index} className={cn("border-t align-top", active && "bg-muted/60")}>
                <td className="px-3 py-2">
                  <span className="font-medium capitalize">{leg.side}</span> {symbolOf(leg.mint)}
                  <div className="text-xs text-muted-foreground">
                    {symbolOf(leg.inputMint)} → {outSymbol}
                    {leg.full && " · whole position"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatUsd(leg.plannedUsd)}</td>
                <td className="px-3 py-2 text-xs">
                  {leg.status === "succeeded" && leg.outputAmount && outDecimals !== undefined ? (
                    <div className="space-y-0.5">
                      <div>
                        Got{" "}
                        <span className="font-medium tabular-nums">
                          {formatBaseUnits(leg.outputAmount, outDecimals)}
                        </span>{" "}
                        {outSymbol}
                      </div>
                      {leg.realizedPrice !== null && (
                        <div className="text-muted-foreground">
                          at {formatUsd(leg.realizedPrice)} per {symbolOf(leg.mint)}
                        </div>
                      )}
                      {leg.signature && (
                        <a
                          href={solscanTxUrl(leg.signature, "mainnet-beta")}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 underline underline-offset-2"
                        >
                          Transaction <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                  ) : quote && outDecimals !== undefined ? (
                    <div className="space-y-0.5">
                      <div>
                        ≈{" "}
                        <span className="font-medium tabular-nums">
                          {formatBaseUnits(quote.outAmount, outDecimals)}
                        </span>{" "}
                        {outSymbol}
                      </div>
                      <div className="text-muted-foreground">
                        Impact {describePriceImpact(quote.priceImpact).text}
                        {quote.feeBps !== null && ` · fee ${quote.feeBps} bps`} · {quote.router}
                      </div>
                    </div>
                  ) : quotes?.get(leg.index) && "error" in quotes.get(leg.index)! ? (
                    <span className="text-muted-foreground">No quote yet</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {leg.error && leg.status !== "succeeded" && (
                    <div
                      className={cn(
                        "mt-1",
                        leg.status === "failed" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {leg.error}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {active && activeStep ? (
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                      <Loader2 className="size-3.5 animate-spin" /> {activeStep}
                    </span>
                  ) : (
                    <Badge variant="outline" className={STATUS[leg.status].className}>
                      {STATUS[leg.status].label}
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function quoteFor(quotes: ReadonlyMap<number, IndicativeQuote> | undefined, index: number) {
  const quote = quotes?.get(index);
  return quote && !("error" in quote) ? quote : null;
}
