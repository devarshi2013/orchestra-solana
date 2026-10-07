"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { AllocationHistory } from "@/components/backtest/allocation-history";
import { EquityChart } from "@/components/backtest/equity-chart";
import { MetricsTable } from "@/components/backtest/metrics-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBacktest } from "@/hooks/use-backtest";
import { fetchMarketData } from "@/lib/api-client";
import { backtestConfigSchema, type RebalanceRule } from "@/lib/backtest/types";
import { EXAMPLE_SYMPHONIES, EXAMPLE_TOKEN_SYMBOLS } from "@/lib/symphony/examples";
import { SOL_MINT } from "@/lib/tokens";

const symbolOf = (mint: string) => EXAMPLE_TOKEN_SYMBOLS[mint] ?? `${mint.slice(0, 4)}…`;
/** Default start leaves this many stored days as indicator warm-up (SMA(50) needs 50). */
const WARM_UP_DAYS = 60;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function BacktestRunner() {
  const { state, run } = useBacktest();
  const [symphonyIndex, setSymphonyIndex] = useState(0);
  const [span, setSpan] = useState<{ first: string; last: string } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rebalanceKind, setRebalanceKind] = useState<RebalanceRule["kind"]>("weekly");
  const [driftPct, setDriftPct] = useState("5");
  const [capital, setCapital] = useState("1000");
  const [feeBps, setFeeBps] = useState("10");
  const [slippageBps, setSlippageBps] = useState("20");
  const [formError, setFormError] = useState<string | null>(null);

  // Default the range to the stored history, after a warm-up for indicators.
  useEffect(() => {
    const controller = new AbortController();
    fetchMarketData([SOL_MINT], controller.signal)
      .then(({ dates }) => {
        if (dates.length < 2) return;
        setSpan({ first: dates[0]!, last: dates[dates.length - 1]! });
        setStartDate(dates[Math.min(WARM_UP_DAYS, dates.length - 2) + 1]!);
        setEndDate(dates[dates.length - 1]!);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const rebalance: RebalanceRule =
      rebalanceKind === "threshold"
        ? { kind: "threshold", driftPct: Number(driftPct) }
        : { kind: rebalanceKind };
    const parsed = backtestConfigSchema.safeParse({
      startDate,
      endDate,
      rebalance,
      startingCapitalUsdc: Number(capital),
      feeBps: Number(feeBps),
      slippageBps: Number(slippageBps),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return;
    }
    setFormError(null);
    void run(EXAMPLE_SYMPHONIES[symphonyIndex]!, parsed.data);
  };

  const symphony = EXAMPLE_SYMPHONIES[symphonyIndex]!;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            {span
              ? `Stored daily prices: ${span.first} to ${span.last}.`
              : "No stored prices yet: run GET /api/cron/prices first."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="symphony">Symphony</Label>
              <select
                id="symphony"
                className={selectClass}
                value={symphonyIndex}
                onChange={(e) => setSymphonyIndex(Number(e.target.value))}
              >
                {EXAMPLE_SYMPHONIES.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{symphony.description}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rebalance">Rebalance</Label>
              <select
                id="rebalance"
                className={selectClass}
                value={rebalanceKind}
                onChange={(e) => setRebalanceKind(e.target.value as RebalanceRule["kind"])}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly (Mondays)</option>
                <option value="monthly">Monthly (1st)</option>
                <option value="threshold">When drift exceeds…</option>
              </select>
            </div>
            {rebalanceKind === "threshold" && (
              <div className="space-y-1.5">
                <Label htmlFor="drift">Drift threshold (percentage points)</Label>
                <Input
                  id="drift"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={driftPct}
                  onChange={(e) => setDriftPct(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="capital">Starting capital (USDC)</Label>
              <Input
                id="capital"
                type="number"
                min="1"
                step="any"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee">Fee (bps per trade)</Label>
              <Input
                id="fee"
                type="number"
                min="0"
                step="any"
                value={feeBps}
                onChange={(e) => setFeeBps(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slippage">Slippage (bps per trade)</Label>
              <Input
                id="slippage"
                type="number"
                min="0"
                step="any"
                value={slippageBps}
                onChange={(e) => setSlippageBps(e.target.value)}
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" disabled={state.status === "running"}>
                {state.status === "running" && <Loader2 className="animate-spin" />}
                Run backtest
              </Button>
            </div>
          </form>
          {formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}
        </CardContent>
      </Card>

      {state.status === "error" && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Backtest failed</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      {state.status === "done" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Equity</CardTitle>
              <CardDescription>
                {formatRange(state.result.equity)} · computed in{" "}
                {Math.max(1, Math.round(state.elapsedMs))} ms in a Web Worker
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EquityChart points={state.result.equity} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricsTable result={state.result} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Allocation history</CardTitle>
              <CardDescription>
                {state.result.rebalances.length} rebalances. Each decides on the previous day&apos;s
                close and fills at it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AllocationHistory rebalances={state.result.rebalances} symbolOf={symbolOf} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function formatRange(equity: readonly { date: string }[]): string {
  return `${equity[0]!.date} to ${equity[equity.length - 1]!.date}`;
}
