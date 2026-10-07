"use client";

import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assistantApi } from "@/lib/api-client";
import type { BacktestSummary, SymphonyProposal } from "@/lib/assistant/views";
import { formatPercent, formatUsd } from "@/lib/backtest/format";
import { diffOutlines, outline, type DiffLine, type OutlineLine } from "@/lib/symphony/outline";
import type { TickerSymphony } from "@/lib/symphony/ticker-tree";
import type { Symphony } from "@/lib/symphony/types";
import { cn } from "@/lib/utils";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A symphony tree as indented lines (symbols, never mints). */
export function OutlineView({ lines }: { lines: readonly (OutlineLine | DiffLine)[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-muted/30 py-1.5 font-mono text-xs leading-relaxed">
      {lines.map((line, i) => {
        const change = "change" in line ? line.change : "same";
        return (
          <div
            key={i}
            className={cn(
              "px-2 whitespace-pre",
              change === "added" && "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
              change === "removed" && "bg-destructive/10 text-destructive line-through",
            )}
            style={{ paddingLeft: `${0.5 + line.depth * 1.1}rem` }}
          >
            <span className="mr-1 inline-block w-3 select-none" aria-hidden>
              {change === "added" ? "+" : change === "removed" ? "−" : ""}
            </span>
            <span className="sr-only">
              {change === "added" ? "Added: " : change === "removed" ? "Removed: " : ""}
            </span>
            {line.text}
          </div>
        );
      })}
    </div>
  );
}

/** The backtester's numbers for a proposal, with the period and settings they came from. */
export function BacktestSummaryView({
  summary,
  note,
}: {
  summary: BacktestSummary | null;
  note: string | null;
}) {
  if (!summary) {
    return <p className="text-xs text-muted-foreground">No backtest: {note ?? "not available"}.</p>;
  }
  const stats: [string, string][] = [
    ["Total return", formatPercent(summary.totalReturn)],
    ["CAGR", formatPercent(summary.cagr)],
    ["Max drawdown", formatPercent(summary.maxDrawdown)],
    ["Volatility", formatPercent(summary.volatility)],
    ["Sharpe", summary.sharpe === null ? "—" : summary.sharpe.toFixed(2)],
    ["SOL buy & hold", formatPercent(summary.solTotalReturn)],
  ];
  return (
    <div className="space-y-1.5">
      <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs sm:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Backtest {summary.from} to {summary.to} ({summary.tradingDays} days),{" "}
        {formatUsd(summary.settings.startingCapitalUsdc)} start,{" "}
        {summary.settings.rebalance.toLowerCase()}, {summary.settings.feeBps} bps fee +{" "}
        {summary.settings.slippageBps} bps slippage, {summary.rebalances} rebalances costing{" "}
        {formatUsd(summary.totalCostUsdc)}. Past results don&apos;t predict future returns.
        {summary.shortHistory.length > 0 &&
          ` Short price history: ${summary.shortHistory
            .map((s) => `${s.ticker} (${s.firstDate ? `from ${s.firstDate}` : "none stored"})`)
            .join(", ")}.`}
      </p>
    </div>
  );
}

/**
 * A symphony the assistant proposed in chat: a preview of the tree and its
 * backtest. Nothing is saved until the user clicks "Open in editor", which
 * creates a draft they can edit, backtest and invest from.
 */
export function SymphonyCard({ proposal }: { proposal: SymphonyProposal }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lines = useMemo(() => outline(proposal.tree), [proposal.tree]);

  const open = async () => {
    setOpening(true);
    setError(null);
    try {
      const { draftId } = await assistantApi.openProposal(proposal.tree);
      router.push(`/create?draft=${draftId}`);
    } catch (e) {
      setError(errorText(e));
      setOpening(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposed symphony · {proposal.tree.name}</CardTitle>
        {proposal.tree.description && (
          <CardDescription>{proposal.tree.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <OutlineView lines={lines} />
        <BacktestSummaryView summary={proposal.backtest} note={proposal.backtestNote} />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void open()} disabled={opening}>
            {opening ? <Loader2 className="animate-spin" /> : <ExternalLink />} Open in editor
          </Button>
          <p className="flex-1 text-xs text-muted-foreground">
            Opens a draft you can change and backtest. Nothing is saved before, and nothing is
            invested unless you choose to from the editor.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export type DiffDecision = "pending" | "applying" | "accepted" | "rejected";

/**
 * A suggested change to the symphony being viewed, as a line diff against the
 * current tree. Accepting applies it (the caller decides how); rejecting
 * leaves everything as it was.
 */
export function SymphonyDiff({
  current,
  proposal,
  onAccept,
  acceptLabel = "Accept change",
  acceptNote,
}: {
  current: TickerSymphony;
  proposal: SymphonyProposal;
  onAccept: (symphony: Symphony) => Promise<void>;
  acceptLabel?: string;
  acceptNote?: string;
}) {
  const [decision, setDecision] = useState<DiffDecision>("pending");
  const [error, setError] = useState<string | null>(null);
  const lines = useMemo(
    () => diffOutlines(outline(current), outline(proposal.tree)),
    [current, proposal.tree],
  );
  const changed = lines.some((l) => l.change !== "same");

  const accept = async () => {
    setDecision("applying");
    setError(null);
    try {
      const { symphony } = await assistantApi.resolveProposal(proposal.tree);
      await onAccept(symphony);
      setDecision("accepted");
    } catch (e) {
      setError(errorText(e));
      setDecision("pending");
    }
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Suggested change · {proposal.tree.name}</p>
      {changed ? (
        <OutlineView lines={lines} />
      ) : (
        <p className="text-xs text-muted-foreground">Same as the current symphony.</p>
      )}
      <BacktestSummaryView summary={proposal.backtest} note={proposal.backtestNote} />
      {decision === "accepted" ? (
        <p className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="size-4" /> Applied.
        </p>
      ) : decision === "rejected" ? (
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <X className="size-4" /> Rejected; nothing changed.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => void accept()}
            disabled={decision === "applying" || !changed}
          >
            {decision === "applying" ? <Loader2 className="animate-spin" /> : <Check />}{" "}
            {acceptLabel}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDecision("rejected")}
            disabled={decision === "applying"}
          >
            <X /> Reject
          </Button>
          {acceptNote && <p className="text-xs text-muted-foreground">{acceptNote}</p>}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
