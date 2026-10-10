"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Info,
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
import { SwapStatus } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useNow } from "@/hooks/use-now";
import type { SavedBuy } from "@/hooks/use-agent-chat";
import { usePlanBuy, type BuyItem } from "@/hooks/use-plan-buy";
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

type PlanCardProps = {
  plan: AcceptedPlan;
  /** The purchase as it last stood, when the chat is reopened. */
  saved?: SavedBuy;
  /** Called as the purchase progresses, so the chat keeps it (and its Solscan links). */
  onBuyChange?: (buy: SavedBuy) => void;
};

/**
 * The assistant's stock plan. In the reply it came with, it's live (see
 * LivePlanCard). Reopened from history it's read-only: its quotes have long
 * expired, so it shows what was planned (and bought, with Solscan links) and
 * offers "Get fresh quote", which turns it live again with new quotes.
 */
export function PlanCard({ archived = false, ...props }: PlanCardProps & { archived?: boolean }) {
  const [live, setLive] = useState(!archived);
  if (live) return <LivePlanCard {...props} />;
  const { plan, saved } = props;
  const total = plan.items.reduce((sum, i) => sum + i.usdcAmount, 0);
  const bought = saved?.items.filter((i) => i.step === "bought").length ?? 0;
  const unfinished = saved ? saved.items.length - bought : plan.items.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {!saved
            ? "Proposed plan"
            : unfinished === 0
              ? "Plan bought"
              : bought > 0
                ? "Plan partly bought"
                : "Plan not bought"}{" "}
          · {formatUsd(total)}
        </CardTitle>
        <CardDescription>Ranking: {plan.rankingMethod}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved ? (
          <PurchaseList items={saved.items} />
        ) : (
          <ul className="divide-y rounded-lg border">
            {plan.items.map((item) => (
              <li
                key={item.symbol}
                className="flex flex-wrap items-start gap-x-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1 basis-44">
                  <span className="font-medium">{item.name}</span>{" "}
                  <Badge variant="outline">{item.symbol}</Badge>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
                </div>
                <span className="text-sm tabular-nums">{formatUsd(item.usdcAmount)}</span>
              </li>
            ))}
          </ul>
        )}
        {unfinished > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setLive(true)}>
              <RefreshCw /> Get fresh quote
            </Button>
            <p className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground">
              From an earlier chat: its quotes have expired. Get fresh quotes to review and buy.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * A plan ready to buy. Before buying: edit amounts or remove items, with a
 * fresh Jupiter quote, warnings per item and pre-flight checks. "Approve &
 * buy" then buys each item in turn; every purchase needs its own signature in
 * the wallet.
 */
function LivePlanCard({ plan, saved, onBuyChange }: PlanCardProps) {
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
  const { quotes, quoting, retrying, refresh } = usePlanQuotes(items, wallet, reviewing);
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
  // The token to buy (the issuer the quote chose, with its mint) comes from the
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
            <PurchaseList items={buy.items} />
            {buy.stopped && <ErrorLine className="text-sm">{buy.stopped}</ErrorLine>}
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
                    loading={!quote && amount > 0 && wallet !== null}
                    retrying={retrying.has(item.symbol)}
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
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
                    )}
                    <span className={cn(check.ok === false && "text-danger")}>{check.label}</span>
                  </li>
                ))}
              </ul>
              {fundsError && <ErrorLine>{fundsError}</ErrorLine>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void approve()} disabled={!ready || buy.running}>
                <ShoppingCart /> Approve &amp; buy {formatUsd(total)}
              </Button>
              <p className="min-w-0 flex-1 basis-56 text-xs text-muted-foreground">
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

/** Each bought (or attempted) item with its status, amount received and Solscan link. */
function PurchaseList({ items }: { items: BuyItem[] }) {
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => (
        <li
          key={item.symbol}
          className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <span className="font-medium">{item.symbol}</span>{" "}
            <span className="text-xs text-muted-foreground">
              {item.name} · {formatUsd(item.usdcAmount)}
            </span>
            {item.error && <ErrorLine className="mt-1">{item.error}</ErrorLine>}
          </div>
          <div className="text-right text-xs">
            <SwapStatus step={item.step} />
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
  );
}

function PlanRow({
  item,
  quote,
  warnings,
  loading,
  retrying,
  onAmount,
  onRemove,
  canRemove,
}: {
  item: DraftItem;
  quote: ItemQuote | undefined;
  warnings: ItemWarning[];
  loading: boolean;
  retrying: boolean;
  onAmount: (text: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const q = quote?.quote;
  return (
    <li className="space-y-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/30">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-44">
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
        {retrying ? (
          <span className="flex items-center gap-1.5" role="status">
            <Loader2 className="size-3 animate-spin" aria-hidden /> Retrying…
          </span>
        ) : loading ? (
          <span
            className="flex w-full items-center gap-3"
            role="status"
            aria-label="Getting a Jupiter quote"
          >
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
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

      {!retrying && warnings.length > 0 && (
        <ul className="space-y-0.5">
          {warnings.map((w) =>
            w.severity === "block" ? (
              // The one error line for this item: red, with a single warning icon.
              <li key={w.kind}>
                <ErrorLine>{w.message}</ErrorLine>
              </li>
            ) : (
              <li key={w.kind} className="flex items-start gap-1 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden /> {w.message}
              </li>
            ),
          )}
        </ul>
      )}
    </li>
  );
}

/** One short error line: red, with a single warning icon. Friendly text only. */
function ErrorLine({ children, className }: { children: string; className?: string }) {
  return (
    <p role="alert" className={cn("flex items-start gap-1.5 text-xs text-danger", className)}>
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
