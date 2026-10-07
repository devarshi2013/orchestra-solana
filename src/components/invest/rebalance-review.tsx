"use client";

import { CheckCircle2, PenLine, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EvaluationWarnings } from "@/components/symphony/evaluation-warnings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRebalanceExecution } from "@/hooks/use-rebalance-execution";
import { useTokenSymbols } from "@/hooks/use-token-symbols";
import { investApi } from "@/lib/api-client";
import { formatPercent, formatUsd } from "@/lib/backtest/format";
import type { SkipReason } from "@/lib/invest/plan";
import type { IndicativeQuote, RunView, SnapshotView } from "@/lib/invest/views";
import { describeWarning } from "@/lib/symphony/warnings";

import { LegTable } from "./leg-table";

const SKIP_TEXT: Record<SkipReason, string> = {
  below_minimum: "under the $10 minimum order",
  below_drift: "within your drift threshold",
  no_price: "no live price; kept in USDC",
};

const STEP_TEXT = {
  quoting: "Getting a fresh quote",
  signing: "Sign in your wallet",
  sending: "Sending",
  confirming: "Confirming on-chain",
} as const;

/**
 * Review & rebalance: plan from live balances, show every swap with its quote,
 * then sign them one by one (sells first). A stopped run keeps its state and
 * can be resumed or cancelled.
 */
export function RebalanceReview({ investmentId }: { investmentId: string }) {
  const [run, setRun] = useState<RunView | null>(null);
  const [nothingToDo, setNothingToDo] = useState<SnapshotView | null>(null);
  const [quotes, setQuotes] = useState<Map<number, IndicativeQuote>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { state, execute, running } = useRebalanceExecution(setRun);

  // Bumped to (re)load; `fresh` skips the open run and plans anew.
  const [request, setRequest] = useState({ fresh: false, n: 0 });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { open } = request.fresh ? { open: null } : await investApi.openRun(investmentId);
        const planned = open ? null : await investApi.planRun(investmentId);
        if (cancelled) return;
        setRun(open ?? planned!.run);
        setNothingToDo(planned && !planned.run ? planned.snapshot : null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [investmentId, request]);

  const reload = (fresh: boolean) => {
    setLoading(true);
    setError(null);
    setNothingToDo(null);
    setRequest((r) => ({ fresh, n: r.n + 1 }));
  };

  // Indicative quotes for the review (real ones are fetched per leg when signing).
  const runId = run?.id;
  const runStarted = run ? run.legs.some((l) => l.status !== "pending") : false;
  useEffect(() => {
    if (!runId || runStarted) return;
    investApi
      .quotes(runId)
      .then(({ quotes }) => setQuotes(new Map(quotes.map((q) => [q.index, q]))))
      .catch(() => {});
  }, [runId, runStarted]);

  const snapshot = run?.plan ?? nothingToDo;
  const mints = useMemo(
    () => [
      ...new Set([
        ...(run?.legs.flatMap((l) => [l.inputMint, l.outputMint]) ?? []),
        ...(snapshot?.plan.positions.map((p) => p.mint) ?? []),
      ]),
    ],
    [run, snapshot],
  );
  const symbolOf = useTokenSymbols(mints);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (error) {
    return (
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Couldn&apos;t plan the rebalance</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const unknownOutcome = run?.legs.some((l) => l.outcomeUnknown) ?? false;
  const remaining =
    run?.legs.filter((l) => l.status !== "succeeded" && l.status !== "skipped").length ?? 0;
  const startOver = async () => {
    if (run) await investApi.cancelRun(run.id).catch(() => {});
    reload(true);
  };

  return (
    <div className="space-y-4">
      {snapshot && (
        <Card>
          <CardHeader>
            <CardTitle>Portfolio</CardTitle>
            <CardDescription>
              {formatUsd(snapshot.plan.totalUsd)} across this symphony&apos;s tokens in your wallet
              {snapshot.asOf && ` · targets from the ${snapshot.asOf} close`}. 0.02 SOL stays in
              your wallet for fees.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <EvaluationWarnings
              messages={snapshot.warnings.map((w) => describeWarning(w, symbolOf))}
            />
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
                {snapshot.plan.positions.map((p) => (
                  <tr key={p.mint} className="border-t">
                    <td className="py-1">{symbolOf(p.mint)}</td>
                    <td className="py-1 text-right">{formatUsd(p.usd)}</td>
                    <td className="py-1 text-right">{formatPercent(p.weight)}</td>
                    <td className="py-1 text-right font-medium">{formatPercent(p.targetWeight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {snapshot.plan.skipped.length > 0 && (
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {snapshot.plan.skipped.map((s) => (
                  <li key={`${s.side}-${s.mint}`}>
                    Not trading {s.side} {symbolOf(s.mint)} ({formatUsd(s.usd)}):{" "}
                    {SKIP_TEXT[s.reason]}.
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {nothingToDo && (
        <Alert>
          <CheckCircle2 />
          <AlertTitle>Nothing to trade</AlertTitle>
          <AlertDescription>
            {nothingToDo.plan.totalUsd < 10
              ? "Your wallet holds less than $10 of this symphony's tokens or USDC. Add USDC (or any of its tokens) to fund it."
              : "Your holdings are already within your thresholds of the target."}
          </AlertDescription>
        </Alert>
      )}

      {run && (
        <Card>
          <CardHeader>
            <CardTitle>
              {run.status === "completed"
                ? "Rebalance complete"
                : run.status === "partial"
                  ? "Rebalance stopped partway"
                  : `Review ${run.legs.length} ${run.legs.length === 1 ? "swap" : "swaps"}`}
            </CardTitle>
            <CardDescription>
              Sells run first, then buys sized from the USDC they produce. Each swap gets a fresh
              quote and needs its own signature in your wallet; you can stop at any prompt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <LegTable
              legs={run.legs}
              quotes={quotes}
              symbolOf={symbolOf}
              activeIndex={state.phase === "running" ? state.legIndex : undefined}
              activeStep={state.phase === "running" ? STEP_TEXT[state.step] : undefined}
            />

            {state.phase === "stopped" && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Stopped</AlertTitle>
                <AlertDescription>
                  {state.message} Swaps already done are recorded below; nothing else was traded.
                </AlertDescription>
              </Alert>
            )}
            {unknownOutcome && (
              <Alert>
                <TriangleAlert />
                <AlertTitle>One swap&apos;s result is unknown</AlertTitle>
                <AlertDescription>
                  Retrying it could trade twice, so start a fresh rebalance: it re-plans from your
                  wallet&apos;s actual balances.
                </AlertDescription>
              </Alert>
            )}

            {run.status === "completed" || state.phase === "done" ? (
              <Alert>
                <CheckCircle2 />
                <AlertTitle>Done</AlertTitle>
                <AlertDescription>
                  Your wallet now matches the target.{" "}
                  <Link href={`/invest/${investmentId}`} className="underline underline-offset-2">
                    Back to the investment
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="flex flex-wrap gap-2">
                {unknownOutcome ? (
                  <Button onClick={startOver} disabled={running}>
                    <RefreshCw /> Start a fresh rebalance
                  </Button>
                ) : (
                  <Button onClick={() => execute(run)} disabled={running || remaining === 0}>
                    <PenLine />
                    {run.status === "planned"
                      ? `Confirm & sign ${remaining} ${remaining === 1 ? "swap" : "swaps"}`
                      : `Resume (${remaining} left)`}
                  </Button>
                )}
                <Button variant="outline" onClick={startOver} disabled={running}>
                  {run.status === "planned" ? "Re-plan" : "Cancel and re-plan"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
