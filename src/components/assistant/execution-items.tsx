"use client";

import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  usePlanExecution,
  buyableIndexes,
  type ItemStep,
  type PlanExecutionState,
} from "@/hooks/use-plan-execution";
import { formatBaseUnits } from "@/lib/amount";
import type { ExecutionItemView, ExecutionView } from "@/lib/assistant/views";
import { formatUsd } from "@/lib/backtest/format";
import { solscanTxUrl } from "@/lib/solana";
import { cn } from "@/lib/utils";

const STEP_LABEL: Record<ItemStep, string> = {
  quoting: "Getting a fresh quote…",
  requoting: "Quote expired, getting a new one…",
  signing: "Approve in your wallet…",
  sending: "Sending…",
  confirming: "Confirming on-chain…",
};

const STATUS: Record<ExecutionItemView["status"], { label: string; className: string }> = {
  pending: { label: "Waiting", className: "text-muted-foreground" },
  quoted: { label: "Awaiting signature", className: "text-amber-700 dark:text-amber-400" },
  executing: { label: "Sending", className: "text-amber-700 dark:text-amber-400" },
  succeeded: { label: "Bought", className: "text-emerald-700 dark:text-emerald-400" },
  failed: { label: "Failed", className: "text-destructive" },
  skipped: { label: "Skipped", className: "text-muted-foreground" },
};

/** One plan execution: per-item status with Solscan links, a summary, and retry for failures. */
export function ExecutionItems({
  execution,
  state,
  onRetry,
  historyLink = true,
}: {
  execution: ExecutionView;
  state: PlanExecutionState;
  onRetry?: () => void;
  historyLink?: boolean;
}) {
  const running = state.phase === "running";
  const bought = execution.items.filter((i) => i.status === "succeeded");
  const failed = execution.items.filter((i) => i.status === "failed");
  const unknown = execution.items.filter((i) => i.outcomeUnknown);
  const retryable = buyableIndexes(execution).length;
  const spent = bought.reduce(
    (sum, i) => sum + (i.inputAmount ? Number(i.inputAmount) / 1e6 : i.usdcAmount),
    0,
  );

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-lg border">
        {execution.items.map((item) => {
          const active = state.phase === "running" && state.index === item.index;
          const status = STATUS[item.status];
          return (
            <li
              key={item.id}
              className={cn(
                "flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-sm",
                active && "bg-muted/60",
              )}
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium">{item.symbol}</span>{" "}
                <Badge variant="outline" className="ml-1">
                  {item.kind}
                </Badge>
                <div className="text-xs text-muted-foreground">
                  {item.name} · {formatUsd(item.usdcAmount)}
                </div>
                {item.error && item.status !== "succeeded" && (
                  <p className="mt-1 text-xs text-destructive">{item.error}</p>
                )}
              </div>
              <div className="text-right text-xs">
                {active ? (
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                    <Loader2 className="size-3 animate-spin" /> {STEP_LABEL[state.step]}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "flex items-center justify-end gap-1 font-medium",
                      status.className,
                    )}
                  >
                    {item.status === "succeeded" && <CheckCircle2 className="size-3" />}
                    {item.status === "failed" && <XCircle className="size-3" />}
                    {item.outcomeUnknown ? "Unknown, check your wallet" : status.label}
                  </span>
                )}
                {item.status === "succeeded" && item.outputAmount && (
                  <div className="text-muted-foreground tabular-nums">
                    +{formatBaseUnits(item.outputAmount, item.decimals)} {item.symbol}
                  </div>
                )}
                {item.signature && (
                  <a
                    href={solscanTxUrl(item.signature, "mainnet-beta")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    Solscan <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {state.phase === "stopped" && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {state.message}
        </p>
      )}

      {!running && (bought.length > 0 || failed.length > 0) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm",
            failed.length > 0
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-emerald-500/40 bg-emerald-500/5",
          )}
        >
          <p className="flex-1">
            {failed.length === 0 && bought.length === execution.items.length ? (
              <>
                All {bought.length} bought for {formatUsd(spent)}.
              </>
            ) : (
              <>
                Bought {bought.length} of {execution.items.length}
                {bought.length > 0 && <> for {formatUsd(spent)}</>}.{" "}
                {failed.length > 0 && (
                  <>
                    {failed.map((i) => i.symbol).join(", ")}{" "}
                    {failed.length === 1 ? "wasn't" : "weren't"} bought; your USDC for{" "}
                    {failed.length === 1 ? "it" : "them"} stays in your wallet.
                  </>
                )}
                {unknown.length > 0 && (
                  <>
                    {" "}
                    Check your wallet for {unknown.map((i) => i.symbol).join(", ")} before buying
                    again.
                  </>
                )}
              </>
            )}
          </p>
          {onRetry && retryable > 0 && (
            <Button size="sm" onClick={onRetry}>
              <RotateCcw /> Retry {retryable === 1 ? "the item" : `${retryable} items`} not bought
            </Button>
          )}
          {historyLink && (
            <Link href="/history" className="text-xs text-primary hover:underline">
              History
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/** An execution with its own retry flow (for /history). */
export function ExecutionWithRetry({ initial }: { initial: ExecutionView }) {
  const [execution, setExecution] = useState(initial);
  const { state, run } = usePlanExecution(setExecution);
  const retry = useCallback(() => void run(execution, buyableIndexes(execution)), [execution, run]);
  return <ExecutionItems execution={execution} state={state} onRetry={retry} historyLink={false} />;
}
