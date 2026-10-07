import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { baseUnitsToNumber, formatBaseUnits } from "@/lib/amount";
import type { OrderResponse } from "@/lib/jupiter/schemas";
import { describePriceImpact, summarizeRoute } from "@/lib/swap/quote";
import type { TokenInfo } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const ROUTER_LABELS: Record<string, string> = {
  metis: "Metis",
  jupiterz: "JupiterZ (RFQ)",
  dflow: "DFlow",
  okx: "OKX",
};

const rateFormatter = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 });
const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function QuoteDetails({
  quote,
  inputToken,
  outputToken,
}: {
  quote: OrderResponse;
  inputToken: TokenInfo;
  outputToken: TokenInfo;
}) {
  const inAmount = baseUnitsToNumber(quote.inAmount, inputToken.decimals);
  const outAmount = baseUnitsToNumber(quote.outAmount, outputToken.decimals);
  const rate = inAmount > 0 ? outAmount / inAmount : 0;
  const impact = describePriceImpact(quote.priceImpact);
  const hops = summarizeRoute(quote);

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Rate</dt>
      <dd className="text-right">
        1 {inputToken.symbol} ≈ {rateFormatter.format(rate)} {outputToken.symbol}
      </dd>

      <dt className="text-muted-foreground">Price impact</dt>
      <dd
        className={cn(
          "text-right",
          impact.severity === "medium" && "text-amber-600",
          impact.severity === "high" && "font-medium text-destructive",
        )}
      >
        {impact.text}
      </dd>

      {/* Without a taker Jupiter skips RTSE and reports 0 slippage, so only show it for real orders. */}
      {quote.otherAmountThreshold && !!quote.slippageBps && (
        <>
          <dt className="text-muted-foreground">Minimum received</dt>
          <dd className="text-right">
            {formatBaseUnits(quote.otherAmountThreshold, outputToken.decimals)} {outputToken.symbol}
            {quote.slippageBps != null && (
              <span className="text-muted-foreground">
                {" "}
                ({(quote.slippageBps / 100).toFixed(2)}% slippage)
              </span>
            )}
          </dd>
        </>
      )}

      {quote.feeBps != null && (
        <>
          <dt className="text-muted-foreground">Fee</dt>
          <dd className="text-right">
            {(quote.feeBps / 100).toFixed(2)}%
            {quote.gasless && (
              <Badge variant="secondary" className="ml-2">
                Gasless
              </Badge>
            )}
          </dd>
        </>
      )}

      {quote.outUsdValue != null && (
        <>
          <dt className="text-muted-foreground">Value</dt>
          <dd className="text-right">{usdFormatter.format(quote.outUsdValue)}</dd>
        </>
      )}

      <dt className="text-muted-foreground">Route</dt>
      <dd className="flex flex-wrap items-center justify-end gap-1 text-right">
        <Badge variant="outline">{ROUTER_LABELS[quote.router] ?? quote.router}</Badge>
        {hops.map((hop, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3 text-muted-foreground" />}
            <span>
              {hop.label}
              {hop.percent < 100 && <span className="text-muted-foreground"> {hop.percent}%</span>}
            </span>
          </span>
        ))}
      </dd>
    </dl>
  );
}
