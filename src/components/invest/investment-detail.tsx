"use client";

import { Pause, Play, Scale } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AskAiPanel } from "@/components/assistant/ask-ai-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTokenSymbols } from "@/hooks/use-token-symbols";
import { investApi } from "@/lib/api-client";
import { formatPercent, formatUsd } from "@/lib/backtest/format";
import { describeRule } from "@/lib/invest/schedule";
import type { InvestmentView, RunView, SnapshotView } from "@/lib/invest/views";

import { LegTable } from "./leg-table";
import { PushToggle } from "./push-toggle";

const RUN_LABEL: Record<RunView["status"], string> = {
  planned: "Planned",
  executing: "In progress",
  completed: "Completed",
  partial: "Stopped partway",
  cancelled: "Cancelled",
};

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }) + " UTC"
    : "—";

export function InvestmentDetail({ id }: { id: string }) {
  const [investment, setInvestment] = useState<(InvestmentView & { runs: RunView[] }) | null>(null);
  const [portfolio, setPortfolio] = useState<SnapshotView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    investApi
      .get(id)
      .then(setInvestment)
      .catch((e: Error) => setError(e.message));
    investApi
      .portfolio(id)
      .then(setPortfolio)
      .catch(() => {});
  }, [id]);
  useEffect(load, [load]);

  const mints = useMemo(
    () => [
      ...new Set([
        ...(portfolio?.plan.positions.map((p) => p.mint) ?? []),
        ...(investment?.runs.flatMap((r) => r.legs.flatMap((l) => [l.inputMint, l.outputMint])) ??
          []),
      ]),
    ],
    [portfolio, investment],
  );
  const symbolOf = useTokenSymbols(mints);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!investment) return <Skeleton className="h-64 w-full" />;

  const setStatus = async (status: InvestmentView["status"]) => {
    await investApi.update(id, { status });
    load();
  };
  const open = investment.runs.find((r) => ["planned", "executing", "partial"].includes(r.status));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{investment.name}</h1>
        <Badge variant="outline">{investment.status}</Badge>
        <span className="flex-1" />
        <Button asChild>
          <Link href={`/invest/${id}/rebalance`}>
            <Scale /> {open?.status === "partial" ? "Resume rebalance" : "Review & rebalance"}
          </Link>
        </Button>
        {investment.status === "active" ? (
          <Button variant="outline" onClick={() => setStatus("paused")}>
            <Pause /> Pause schedule
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setStatus("active")}>
            <Play /> Resume schedule
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
          <CardDescription>
            {describeRule(investment.rebalance)} · skips trades within{" "}
            {investment.driftThresholdPct} pts of target. When a rebalance is due you get an in-app
            banner
            {investment.notifyEmail ? ` and an email to ${investment.notifyEmail}` : ""}. Nothing
            trades until you sign.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <div className="text-muted-foreground">Next check</div>
            {investment.status === "active" ? when(investment.nextDueAt) : "Paused"}
          </div>
          <div>
            <div className="text-muted-foreground">Last rebalanced</div>
            {when(investment.lastRebalancedAt)}
          </div>
          <div className="sm:col-span-2">
            <PushToggle />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Holdings vs target</CardTitle>
          <CardDescription>
            {!portfolio
              ? "Reading your wallet…"
              : portfolio.plan.totalUsd < 1
                ? "Nothing invested yet: add USDC (or the symphony's tokens) to your wallet, then review & rebalance."
                : `${formatUsd(portfolio.plan.totalUsd)} in your wallet · largest drift ${(portfolio.maxDriftPct ?? 0).toFixed(1)} pts`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portfolio ? (
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Token</th>
                  <th className="py-1 text-right font-medium">Value</th>
                  <th className="py-1 text-right font-medium">Now</th>
                  <th className="py-1 text-right font-medium">Target</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.plan.positions.map((p) => (
                  <tr key={p.mint} className="border-t">
                    <td className="py-1">{symbolOf(p.mint)}</td>
                    <td className="py-1 text-right">{formatUsd(p.usd)}</td>
                    <td className="py-1 text-right">{formatPercent(p.weight)}</td>
                    <td className="py-1 text-right font-medium">{formatPercent(p.targetWeight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rebalances</CardTitle>
          <CardDescription>
            Every swap, with what actually moved and the price you got.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {investment.runs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              None yet. Review & rebalance to fund it.
            </p>
          )}
          {investment.runs.map((run) => (
            <div key={run.id} className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{when(run.createdAt)}</span>
                <Badge variant="outline">{RUN_LABEL[run.status]}</Badge>
              </div>
              <LegTable legs={run.legs} symbolOf={symbolOf} />
            </div>
          ))}
        </CardContent>
      </Card>

      <AskAiPanel
        current={investment.symphony}
        context={() => ({ kind: "investment", investmentId: id })}
        onAccept={async (symphony) => {
          await investApi.update(id, { symphony });
          load();
        }}
        acceptLabel="Apply to this investment"
        acceptNote="Changes the strategy from the next rebalance. Nothing trades until you sign."
        description="Explain this portfolio's strategy or its last rebalance, suggest changes (as a diff you accept or reject) or compare backtests."
      />
    </div>
  );
}
