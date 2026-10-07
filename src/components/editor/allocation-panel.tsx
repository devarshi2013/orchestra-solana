"use client";

import { FlaskConical, Loader2 } from "lucide-react";
import { useMemo } from "react";

import { AllocationList } from "@/components/symphony/allocation-list";
import { EvaluationWarnings } from "@/components/symphony/evaluation-warnings";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketData } from "@/hooks/use-market-data";
import { evaluateWithWarnings, SymphonyEvaluationError } from "@/lib/symphony/evaluate";
import type { MarketData } from "@/lib/symphony/market-data";
import { collectMints } from "@/lib/symphony/mints";
import type { Symphony } from "@/lib/symphony/types";
import { describeWarning } from "@/lib/symphony/warnings";
import { SOL_MINT } from "@/lib/tokens";

import { useSymbolOf } from "./editor-context";

/**
 * "Allocation today": evaluate() on the latest stored daily close, plus the
 * Backtest button, which needs the same prices.
 */
export function AllocationPanel({
  symphony,
  valid,
  backtesting,
  onBacktest,
}: {
  symphony: Symphony;
  valid: boolean;
  backtesting: boolean;
  onBacktest: (data: MarketData) => void;
}) {
  const symbolOf = useSymbolOf();
  const mints = useMemo(() => [...collectMints(symphony.root), SOL_MINT], [symphony.root]);
  const { data, error, loading } = useMarketData(mints, valid);

  const today = useMemo(() => {
    if (!valid || !data) return null;
    const asOf = data.dates[data.dates.length - 1] ?? "";
    try {
      return { asOf, ...evaluateWithWarnings(symphony.root, data, asOf) };
    } catch (e) {
      if (e instanceof SymphonyEvaluationError) return { asOf, error: e.message };
      throw e;
    }
  }, [valid, data, symphony.root]);

  const unstored = data
    ? mints.filter((mint) => !(data.closes[mint] ?? []).some((close) => close !== null))
    : [];

  return (
    <section className="space-y-3 rounded-lg border bg-card p-3" aria-labelledby="today-heading">
      <div>
        <h2 id="today-heading" className="font-medium">
          Allocation today
        </h2>
        <p className="text-xs text-muted-foreground">
          {today?.asOf ? `As of the ${today.asOf} daily close (UTC).` : "From stored daily closes."}
        </p>
      </div>
      {!valid && (
        <p className="text-sm text-muted-foreground">Fix the highlighted problems to see it.</p>
      )}
      {valid && loading && <Skeleton className="h-24 w-full" />}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {today && "error" in today && <p className="text-sm text-destructive">{today.error}</p>}
      {today && "allocation" in today && (
        <>
          <EvaluationWarnings messages={today.warnings.map((w) => describeWarning(w, symbolOf))} />
          <AllocationList
            rows={Object.entries(today.allocation)
              .map(([mint, weight]) => ({ mint, symbol: symbolOf(mint), weight }))
              .sort((a, b) => b.weight - a.weight)}
          />
        </>
      )}
      {unstored.length > 0 && (
        <p className="text-xs text-muted-foreground">
          No stored prices yet for {unstored.map(symbolOf).join(", ")}. Saving the draft tracks
          them; the next price sync (daily, or GET /api/cron/prices) backfills their history.
        </p>
      )}
      <Button
        className="w-full"
        disabled={!valid || !data || backtesting}
        onClick={() => data && onBacktest(data)}
      >
        {backtesting ? <Loader2 className="animate-spin" /> : <FlaskConical />}
        Backtest
      </Button>
    </section>
  );
}
