"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNow } from "@/hooks/use-now";
import { buyableIndexes, usePlanExecution } from "@/hooks/use-plan-execution";
import { usePlanQuotes, useWalletFunds } from "@/hooks/use-plan-quotes";
import type { AcceptedPlan } from "@/lib/agent/plan";
import { ApiError, assistantApi } from "@/lib/api-client";
import { itemWarnings, preflight, type ItemQuote, type ItemWarning } from "@/lib/assistant/review";
import type { ExecutionView } from "@/lib/assistant/views";
import { formatUsd } from "@/lib/backtest/format";
import { describePriceImpact } from "@/lib/swap/quote";
import { cn } from "@/lib/utils";

import { ExecutionItems } from "./execution-items";

type PlanItem = AcceptedPlan["items"][number];
type DraftItem = PlanItem & { amountText: string };

const SECTIONS = [
  { kind: "stock", title: "Stocks" },
  { kind: "crypto", title: "Crypto" },
] as const;

const parseAmount = (text: string) => {
  const value = Number(text);
  return text.trim() !== "" && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : 0;
};

/**
 * The assistant's plan, split into stocks and crypto. Before buying: edit
 * amounts or remove items, with a fresh Jupiter quote and warnings per item
 * and pre-flight checks. "Approve & buy" records the plan, then buys each
 * item in turn; every purchase needs its own signature in the wallet.
 */
export function PlanCard({
  plan,
  conversationId,
  boughtBefore = false,
}: {
  plan: AcceptedPlan;
  conversationId: string | null;
  boughtBefore?: boolean;
}) {
  const { connected, signTransaction } = useWallet();
  const [draft, setDraft] = useState<DraftItem[]>(() =>
    plan.items.map((item) => ({ ...item, amountText: String(item.usdcAmount) })),
  );
  const [execution, setExecution] = useState<ExecutionView | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const { state, run, running } = usePlanExecution(setExecution);
  const reviewing = execution === null;

  const items = useMemo(
    () =>
      draft.map((d) => ({ symbol: d.symbol, kind: d.kind, usdcAmount: parseAmount(d.amountText) })),
    [draft],
  );
  const { quotes, quoting, refresh } = usePlanQuotes(items, reviewing);
  const { funds, error: fundsError, reload: reloadFunds } = useWalletFunds(true);
  const now = new Date(useNow());
  const total = Math.round(items.reduce((sum, i) => sum + i.usdcAmount, 0) * 100) / 100;
  const checks = preflight({
    wallet: { connected, canSign: Boolean(signTransaction) },
    balances: funds,
    items,
    quotes,
    quoting,
    now,
  });
  const ready = checks.every((c) => c.ok === true);

  const setAmount = (symbol: string, amountText: string) =>
    setDraft((all) => all.map((d) => (d.symbol === symbol ? { ...d, amountText } : d)));
  const remove = (symbol: string) => setDraft((all) => all.filter((d) => d.symbol !== symbol));

  const approve = async () => {
    if (!ready || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await assistantApi.createExecution({
        conversationId: conversationId ?? undefined,
        rankingMethod: plan.rankingMethod,
        items: draft.map((d) => ({
          kind: d.kind,
          symbol: d.symbol,
          usdcAmount: parseAmount(d.amountText),
          reason: d.reason,
        })),
      });
      setExecution(created);
      setCreating(false);
      await run(created, buyableIndexes(created));
      reloadFunds();
    } catch (error) {
      setCreateError(
        error instanceof ApiError || error instanceof Error ? error.message : String(error),
      );
      setCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {!execution
            ? "Proposed plan"
            : execution.status === "completed"
              ? "Plan bought"
              : execution.status === "partial" && !running
                ? "Plan partly bought"
                : "Buying your plan"}{" "}
          · {formatUsd(execution ? execution.totalUsdc : total)}
        </CardTitle>
        <CardDescription>Ranking: {plan.rankingMethod}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {execution ? (
          <ExecutionItems
            execution={execution}
            state={state}
            onRetry={
              running
                ? undefined
                : () => void run(execution, buyableIndexes(execution)).then(reloadFunds)
            }
          />
        ) : (
          <>
            {boughtBefore && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                You&apos;ve already bought a plan from this chat; see{" "}
                <Link href="/history" className="text-primary hover:underline">
                  History
                </Link>{" "}
                before buying again.
              </p>
            )}
            {SECTIONS.map(({ kind, title }) => {
              const rows = draft.filter((d) => d.kind === kind);
              if (rows.length === 0) return null;
              const subtotal = rows.reduce((sum, d) => sum + parseAmount(d.amountText), 0);
              return (
                <section key={kind} className="space-y-2">
                  <h3 className="flex items-baseline justify-between text-sm font-medium">
                    {title}
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {formatUsd(subtotal)}
                    </span>
                  </h3>
                  <ul className="divide-y rounded-lg border">
                    {rows.map((item) => {
                      const amount = parseAmount(item.amountText);
                      const quote = quotes.get(item.symbol);
                      return (
                        <PlanRow
                          key={item.symbol}
                          item={item}
                          quote={quote}
                          warnings={itemWarnings(
                            { kind: item.kind, usdcAmount: amount },
                            quote,
                            now,
                          )}
                          loading={!quote && amount > 0}
                          onAmount={(text) => setAmount(item.symbol, text)}
                          onRemove={() => remove(item.symbol)}
                          canRemove={draft.length > 1}
                        />
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Before you buy</h3>
                <Button variant="ghost" size="xs" onClick={refresh} disabled={quoting}>
                  <RefreshCw className={cn(quoting && "animate-spin")} /> Refresh quotes
                </Button>
              </div>
              <ul className="space-y-1 text-sm">
                {checks.map((check) => (
                  <li key={check.id} className="flex items-start gap-1.5">
                    {check.ok === null ? (
                      <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    ) : check.ok ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    )}
                    <span className={cn(check.ok === false && "text-destructive")}>
                      {check.label}
                    </span>
                  </li>
                ))}
              </ul>
              {fundsError && <p className="text-xs text-destructive">{fundsError}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void approve()} disabled={!ready || creating}>
                {creating ? <Loader2 className="animate-spin" /> : <ShoppingCart />} Approve &amp;
                buy {formatUsd(total)}
              </Button>
              <p className="flex-1 text-xs text-muted-foreground">
                Each item is a separate swap you approve in your wallet: {draft.length}{" "}
                {draft.length === 1 ? "signature" : "signatures"}. Nothing is signed automatically.
              </p>
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </>
        )}
        <p className="text-xs text-muted-foreground">
          AI-generated research, not financial advice. Quotes move with the market; each buy is
          re-quoted right before you sign.
        </p>
      </CardContent>
    </Card>
  );
}

function PlanRow({
  item,
  quote,
  warnings,
  loading,
  onAmount,
  onRemove,
  canRemove,
}: {
  item: DraftItem;
  quote: ItemQuote | undefined;
  warnings: ItemWarning[];
  loading: boolean;
  onAmount: (text: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const q = quote?.quote;
  return (
    <li className="space-y-2 px-3 py-2.5 text-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{item.name}</span>
            <Badge variant="outline">{item.symbol}</Badge>
            {item.ticker !== item.symbol && (
              <span className="text-xs text-muted-foreground">{item.ticker}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
        </div>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">USDC amount for {item.symbol}</span>
          <Input
            inputMode="decimal"
            value={item.amountText}
            onChange={(e) => onAmount(e.target.value.replace(/[^\d.]/g, ""))}
            className="h-7 w-24 text-right tabular-nums"
          />
          <span className="text-xs text-muted-foreground">USDC</span>
        </label>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${item.symbol}`}
          title={canRemove ? `Remove ${item.symbol}` : "A plan needs at least one item"}
        >
          <X />
        </Button>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
        {loading ? (
          <span className="flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> Getting a Jupiter quote…
          </span>
        ) : q ? (
          <>
            <span>
              You get ≈{" "}
              <span className="font-medium text-foreground">
                {q.expectedOut.toLocaleString("en-US", { maximumSignificantDigits: 6 })} {q.symbol}
              </span>
            </span>
            <span>Price impact {describePriceImpact(q.priceImpactPct).text}</span>
            <span>
              Fees{" "}
              {[
                q.feeBps !== null ? `${(q.feeBps / 100).toFixed(2)}% Jupiter` : null,
                q.gasless
                  ? "no network fee (gasless)"
                  : q.networkFeesSol !== null
                    ? `${q.networkFeesSol.toFixed(5)} SOL network`
                    : null,
              ]
                .filter(Boolean)
                .join(" + ") || "unknown"}
            </span>
          </>
        ) : null}
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-0.5">
          {warnings.map((w) => (
            <li
              key={w.kind + w.message}
              className={cn(
                "flex items-start gap-1 text-xs",
                w.severity === "block" ? "text-destructive" : "text-amber-700 dark:text-amber-400",
              )}
            >
              <TriangleAlert className="mt-0.5 size-3 shrink-0" /> {w.message}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
