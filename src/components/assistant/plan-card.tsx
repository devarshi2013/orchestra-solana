"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShoppingCart,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiquidityBadge } from "@/components/assistant/liquidity-badge";
import { Input } from "@/components/ui/input";
import { useNow } from "@/hooks/use-now";
import type { SavedBuy } from "@/hooks/use-agent-chat";
import { usePlanBuy, type BuyItem, type BuyStep } from "@/hooks/use-plan-buy";
import { usePlanQuotes, useWalletFunds } from "@/hooks/use-plan-quotes";
import type { AcceptedPlan } from "@/lib/agent/plan";
import { formatBaseUnits } from "@/lib/amount";
import { itemWarnings, preflight, type ItemQuote, type ItemWarning } from "@/lib/assistant/review";
import { formatUsd } from "@/lib/format";
import { solscanTxUrl } from "@/lib/solana";
import { describePriceImpact } from "@/lib/swap/quote";
import { cn } from "@/lib/utils";

type PlanItem = AcceptedPlan["items"][number];
type DraftItem = PlanItem & { amountText: string };

const parseAmount = (text: string) => {
  const value = Number(text);
  return text.trim() !== "" && Number.isFinite(value) && value > 0
    ? Math.round(value * 100) / 100
    : 0;
};

const STEP_LABEL: Record<BuyStep, string> = {
  waiting: "Waiting",
  quoting: "Getting a fresh quote…",
  signing: "Approve in your wallet…",
  sending: "Sending…",
  bought: "Bought",
  failed: "Failed",
};

/**
 * The assistant's stock plan. Before buying: edit amounts or remove items,
 * with a fresh Jupiter quote, warnings per item and pre-flight checks.
 * "Approve & buy" then buys each item in turn; every purchase needs its own
 * signature in the wallet.
 */
export function PlanCard({
  plan,
  saved,
  onBuyChange,
}: {
  plan: AcceptedPlan;
  /** The purchase as it last stood, when the chat is reopened. */
  saved?: SavedBuy;
  /** Called as the purchase progresses, so the chat keeps it (and its Solscan links). */
  onBuyChange?: (buy: SavedBuy) => void;
}) {
  const { connected, publicKey, signTransaction } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [draft, setDraft] = useState<DraftItem[]>(() =>
    plan.items.map((item) => ({ ...item, amountText: String(item.usdcAmount) })),
  );
  const buy = usePlanBuy(saved);
  const reviewing = buy.items === null;
  useEffect(() => {
    if (buy.items) onBuyChange?.({ items: buy.items, stopped: buy.stopped });
    // onBuyChange is a fresh closure each render; only report real changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buy.items, buy.stopped]);

  const items = useMemo(
    () =>
      draft.map((d) => ({ symbol: d.symbol, kind: d.kind, usdcAmount: parseAmount(d.amountText) })),
    [draft],
  );
  const { quotes, quoting, refresh } = usePlanQuotes(items, wallet, reviewing);
  const { funds, error: fundsError, reload: reloadFunds } = useWalletFunds(wallet);
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
  // The token to buy (the cheapest issuer, with its mint) comes from the
  // server's quote, which reads it from the stock registry: never from the model.
  const tokenOf = (symbol: string) => quotes.get(symbol)?.token ?? null;
  const ready = checks.every((c) => c.ok === true) && draft.every((d) => tokenOf(d.symbol));

  const setAmount = (symbol: string, amountText: string) =>
    setDraft((all) => all.map((d) => (d.symbol === symbol ? { ...d, amountText } : d)));
  const remove = (symbol: string) => setDraft((all) => all.filter((d) => d.symbol !== symbol));

  const approve = async () => {
    if (!ready) return;
    const toBuy: BuyItem[] = draft.map((d) => {
      const token = tokenOf(d.symbol)!;
      return {
        symbol: token.symbol,
        name: `${d.name} · ${token.issuer}`,
        mint: token.mint,
        decimals: token.decimals,
        usdcAmount: parseAmount(d.amountText),
        step: "waiting",
        signature: null,
        outAmount: null,
        error: null,
      };
    });
    await buy.run(toBuy);
    reloadFunds();
  };

  const bought = buy.items?.filter((i) => i.step === "bought") ?? [];
  const failed = buy.items?.filter((i) => i.step === "failed" || i.step === "waiting") ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {reviewing
            ? "Proposed plan"
            : buy.running
              ? "Buying your plan"
              : failed.length === 0
                ? "Plan bought"
                : bought.length > 0
                  ? "Plan partly bought"
                  : "Plan not bought"}{" "}
          · {formatUsd(total)}
        </CardTitle>
        <CardDescription>Ranking: {plan.rankingMethod}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {buy.items ? (
          <div className="space-y-3">
            <ul className="divide-y rounded-lg border">
              {buy.items.map((item) => (
                <li
                  key={item.symbol}
                  className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{item.symbol}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {item.name} · {formatUsd(item.usdcAmount)}
                    </span>
                    {item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}
                  </div>
                  <div className="text-right text-xs">
                    <span
                      className={cn(
                        "flex items-center justify-end gap-1 font-medium",
                        item.step === "bought" && "text-success",
                        item.step === "failed" && "text-destructive",
                        ["quoting", "signing", "sending"].includes(item.step) && "text-warning",
                      )}
                    >
                      {["quoting", "signing", "sending"].includes(item.step) && (
                        <Loader2 className="size-3 animate-spin" />
                      )}
                      {item.step === "bought" && <CheckCircle2 className="size-3" />}
                      {item.step === "failed" && <XCircle className="size-3" />}
                      {STEP_LABEL[item.step]}
                    </span>
                    {item.step === "bought" && item.outAmount && (
                      <div className="text-muted-foreground tabular-nums">
                        +{formatBaseUnits(item.outAmount, item.decimals)} {item.symbol}
                      </div>
                    )}
                    {item.signature && (
                      <a
                        href={solscanTxUrl(item.signature, "mainnet-beta")}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary-text hover:underline"
                      >
                        Solscan <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {buy.stopped && (
              <p className="flex items-start gap-1.5 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {buy.stopped}
              </p>
            )}
            {!buy.running && (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm",
                  failed.length > 0
                    ? "border-warning/40 bg-warning/5"
                    : "border-success/40 bg-success/5",
                )}
              >
                <p className="min-w-0 flex-1 basis-56">
                  {failed.length === 0
                    ? `All ${bought.length} bought.`
                    : `Bought ${bought.length} of ${buy.items.length}. ${failed
                        .map((i) => i.symbol)
                        .join(
                          ", ",
                        )} ${failed.length === 1 ? "wasn't" : "weren't"} bought; that USDC stays in your wallet.`}
                </p>
                {failed.length > 0 && (
                  <Button size="sm" onClick={buy.retry}>
                    <RotateCcw /> Retry{" "}
                    {failed.length === 1 ? "the item" : `${failed.length} items`} not bought
                  </Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <ul className="divide-y rounded-lg border">
              {draft.map((item) => {
                const amount = parseAmount(item.amountText);
                const quote = quotes.get(item.symbol);
                return (
                  <PlanRow
                    key={item.symbol}
                    item={item}
                    quote={quote}
                    warnings={itemWarnings({ kind: item.kind, usdcAmount: amount }, quote, now)}
                    loading={!quote && amount > 0}
                    onAmount={(text) => setAmount(item.symbol, text)}
                    onRemove={() => remove(item.symbol)}
                    canRemove={draft.length > 1}
                  />
                );
              })}
            </ul>

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
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
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
              <Button onClick={() => void approve()} disabled={!ready || buy.running}>
                <ShoppingCart /> Approve &amp; buy {formatUsd(total)}
              </Button>
              <p className="flex-1 text-xs text-muted-foreground">
                Each stock is a separate swap you approve in your wallet: {draft.length}{" "}
                {draft.length === 1 ? "signature" : "signatures"}. Nothing is signed automatically.
              </p>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          AI-generated research, not financial advice. Tokenized stocks are securities with
          eligibility rules. Each buy is re-quoted right before you sign.
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
            {quote?.token && (
              <>
                <span className="text-xs text-muted-foreground">
                  via {quote.token.symbol} ({quote.token.issuer})
                </span>
                <LiquidityBadge tier={quote.token.liquidityTier} />
              </>
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
                w.severity === "block" ? "text-destructive" : "text-warning",
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
