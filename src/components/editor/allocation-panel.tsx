"use client";

import { CircleAlert, FlaskConical } from "lucide-react";
import { useMemo } from "react";

import { AllocationList } from "@/components/symphony/allocation-list";
import { EvaluationWarnings } from "@/components/symphony/evaluation-warnings";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
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
    <Section
      title="Allocation today"
      description={
        today?.asOf ? `As of the ${today.asOf} daily close (UTC).` : "From stored daily closes."
      }
      bodyClassName="space-y-4"
    >
      {!valid && (
        <EmptyState icon={<CircleAlert />} title="Fix the highlighted problems">
          Today&apos;s allocation and the backtest appear once the symphony is valid.
        </EmptyState>
      )}
      {valid && loading && (
        <div className="space-y-3" aria-label="Loading prices">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-2 w-full" />
        </div>
      )}
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
        <p className="type-caption">
          No stored prices yet for {unstored.map(symbolOf).join(", ")}. Saving the draft tracks
          them; the next price sync (daily, or GET /api/cron/prices) backfills their history.
        </p>
      )}
      <Button
        className="w-full"
        size="lg"
        loading={backtesting}
        disabled={!valid || !data}
        onClick={() => data && onBacktest(data)}
      >
        <FlaskConical />
        {backtesting ? "Backtesting…" : "Backtest"}
      </Button>
    </Section>
  );
}
