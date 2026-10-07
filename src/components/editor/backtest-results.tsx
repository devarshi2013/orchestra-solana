"use client";

import { TriangleAlert } from "lucide-react";

import { EquityChart } from "@/components/backtest/equity-chart";
import { MetricsTable } from "@/components/backtest/metrics-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { BacktestState } from "@/hooks/use-backtest";
import { formatUsd } from "@/lib/backtest/format";
import type { BacktestConfig } from "@/lib/backtest/types";

export function BacktestResults({
  state,
  config,
}: {
  state: BacktestState;
  config: BacktestConfig | null;
}) {
  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Backtest failed</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  if (state.status !== "done" || !config) return null;
  const { result } = state;
  return (
    <section className="space-y-4 rounded-lg border bg-card p-4" aria-labelledby="backtest-heading">
      <div>
        <h2 id="backtest-heading" className="font-medium">
          Backtest
        </h2>
        <p className="text-xs text-muted-foreground">
          {config.startDate} to {config.endDate} · {config.rebalance.kind} rebalance ·{" "}
          {formatUsd(config.startingCapitalUsdc)} · {config.feeBps} bps fee · {config.slippageBps}{" "}
          bps slippage · {result.rebalances.length} rebalances
        </p>
      </div>
      <EquityChart points={result.equity} />
      <MetricsTable result={result} />
    </section>
  );
}
