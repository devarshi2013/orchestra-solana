"use client";

import { FlaskConical, TriangleAlert } from "lucide-react";

import { EquityChart } from "@/components/backtest/equity-chart";
import { MetricsTable } from "@/components/backtest/metrics-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
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
  if (state.status === "running") {
    return (
      <Section
        title="Backtest"
        description="Simulating on stored daily closes…"
        bodyClassName="space-y-4"
      >
        <div aria-busy="true" aria-label="Running the backtest" className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        </div>
      </Section>
    );
  }
  if (state.status !== "done" || !config) {
    return (
      <Section title="Backtest">
        <EmptyState icon={<FlaskConical />} title="No backtest yet">
          Press Backtest in &ldquo;Allocation today&rdquo; to simulate this symphony on stored daily
          prices, with fees and slippage. Results appear here.
        </EmptyState>
      </Section>
    );
  }
  const { result } = state;
  return (
    <Section
      title="Backtest"
      description={`${config.startDate} to ${config.endDate} · ${config.rebalance.kind} rebalance · ${formatUsd(config.startingCapitalUsdc)} · ${config.feeBps} bps fee · ${config.slippageBps} bps slippage · ${result.rebalances.length} rebalances`}
      bodyClassName="space-y-6"
    >
      <EquityChart points={result.equity} />
      <MetricsTable result={result} />
    </Section>
  );
}
