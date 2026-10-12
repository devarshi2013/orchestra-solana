"use client";

import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Info,
  RefreshCw,
  TriangleAlert,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { useWallet } from "@/components/wallet";
import { CardReveal, Expand, RevealRow, RollText, SwapStatus } from "@/components/motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { SavedBuy } from "@/hooks/use-agent-chat";
import { usePlanBuy, type BuyItem } from "@/hooks/use-plan-buy";
import { usePlanQuotes, useWalletFunds } from "@/hooks/use-plan-quotes";
import type { AcceptedPlan } from "@/lib/agent/plan";
import { formatBaseUnits } from "@/lib/amount";
import { itemWarnings, preflight, type ItemQuote, type ItemWarning } from "@/lib/assistant/review";
import { formatUsd, parseUsd } from "@/lib/format";
import { solscanTxUrl } from "@/lib/solana";
import { describePriceImpact } from "@/lib/swap/quote";
import { cn } from "@/lib/utils";

import { IconButton, SoftButton } from "./controls";

type DraftItem = AcceptedPlan["items"][number] & { amountText: string };

/** A pre-flight check's mark: pending, passed or failed. */
const CHECK_ICON = {
  null: <Circle className="mt-0.5 size-3.5 shrink-0 text-ink-muted" />,
  true: <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-text-high" />,
  false: <XCircle className="mt-0.5 size-3.5 shrink-0 text-status-error-text" />,
};

/** A finished (or reopened) plan's title, from how many items are still not bought. */
const outcome = (unbought: number, bought: number) =>
  unbought === 0 ? "Plan bought" : bought > 0 ? "Plan partly bought" : "Plan not bought";

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
    <Ticket
      title={saved ? outcome(unfinished, bought) : "Proposed plan"}
      total={total}
      method={plan.rankingMethod}
    >
      {saved ? (
        <PurchaseList items={saved.items} />
      ) : (
        <ul className="divide-y divide-soft">
          {plan.items.map((item) => (
            <li key={item.symbol} className="flex flex-wrap items-start gap-x-3 py-3 first:pt-0">
              <div className="min-w-0 flex-1 basis-44">
                <ItemName item={item} />
                <p className="mt-0.5 text-[12.5px] text-ink-muted">{item.reason}</p>
              </div>
              <span className="font-medium text-text-extra-high tabular-nums">
                {formatUsd(item.usdcAmount)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <TotalRow count={plan.items.length} total={total} />
      {unfinished > 0 && (
        <SoftButton onClick={() => setLive(true)}>
          <RefreshCw className="size-3.5" /> Get fresh quotes
        </SoftButton>
      )}
    </Ticket>
  );
}

/** The plan's card: its status, ranking and total, then the lines and actions. */
function Ticket({
  title,
  total,
  method,
  children,
}: {
  title: string;
  total: number;
  method: string;
  children: ReactNode;
}) {
  return (
    <CardReveal className="rounded-[20px] bg-white text-[14px] tracking-[-0.01em] shadow-hairline">
      <section aria-label={title} className="p-5">
        <RevealRow className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-text-extra-high">{title}</h3>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">{method}</p>
          </div>
          <RollText
            value={formatUsd(total)}
            className="text-[22px] font-semibold text-text-extra-high"
          />
        </RevealRow>
        <div className="space-y-4">{children}</div>
      </section>
    </CardReveal>
  );
}

/** The ticket's total line. */
function TotalRow({ count, total }: { count: number; total: number }) {
  return (
    <p className="flex items-baseline justify-between gap-3 rounded-[12px] bg-soft px-3 py-2">
      <span className="text-[12.5px] text-ink-muted">
        {count} {count === 1 ? "item" : "items"}
      </span>
      <span className="font-semibold text-text-extra-high">
        <RollText value={formatUsd(total)} /> USDC
      </span>
    </p>
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
      draft.map((d) => ({
        symbol: d.symbol,
        kind: d.kind,
        usdcAmount: parseUsd(d.amountText),
      })),
    [draft],
  );
  const { quotes, quoting, refresh } = usePlanQuotes(items, wallet, reviewing);
  const { funds, error: fundsError, reload: reloadFunds } = useWalletFunds(wallet);
  const total = Math.round(items.reduce((sum, i) => sum + i.usdcAmount, 0) * 100) / 100;
  const checks = preflight({
    wallet: { connected, canSign: Boolean(signTransaction) },
    balances: funds,
    items,
    quotes,
    quoting,
  });
  // The token to buy (with its mint) comes from the server's quote, which reads
  // it from the live stock universe: never from the model.
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
        name: token.issuer ? `${d.name} · ${token.issuer}` : d.name,
        mint: token.mint,
        decimals: token.decimals,
        usdcAmount: parseUsd(d.amountText),
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
    <Ticket
      title={
        reviewing
          ? "Proposed plan"
          : buy.running
            ? "Buying your plan"
            : outcome(failed.length, bought.length)
      }
      total={total}
      method={plan.rankingMethod}
    >
      {buy.items ? (
        <div className="space-y-3">
          <PurchaseList items={buy.items} />
          {buy.stopped && <ErrorLine>{buy.stopped}</ErrorLine>}
          {!buy.running && (
            <div className="flex flex-wrap items-center gap-3 rounded-[14px] bg-soft p-2 pl-3.5">
              <p className="min-w-0 flex-1 basis-48 text-text-high">
                {failed.length === 0
                  ? `All ${bought.length} bought`
                  : `Bought ${bought.length} of ${buy.items.length}`}
              </p>
              {failed.length > 0 && (
                <SoftButton dark onClick={buy.retry}>
                  Retry {failed.length}
                </SoftButton>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-soft">
            {draft.map((item) => {
              const amount = parseUsd(item.amountText);
              const quote = quotes.get(item.symbol);
              return (
                <PlanRow
                  key={item.symbol}
                  item={item}
                  quote={quote}
                  warnings={itemWarnings(quote)}
                  loading={!quote && amount > 0 && wallet !== null}
                  onAmount={(text) => setAmount(item.symbol, text)}
                  onRemove={() => remove(item.symbol)}
                  canRemove={draft.length > 1}
                />
              );
            })}
          </ul>
          <TotalRow count={draft.length} total={total} />

          <div className="space-y-2 rounded-[14px] bg-soft px-3.5 py-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[12.5px] font-medium text-ink-muted">Checks</h4>
              <IconButton
                onClick={refresh}
                disabled={quoting}
                aria-label="Refresh quotes"
                className="-my-1 size-7 hover:bg-white [&_svg]:size-3.5"
              >
                <RefreshCw className={cn(quoting && "animate-spin")} />
              </IconButton>
            </div>
            <ul className="space-y-1 text-[13.5px] text-text-high">
              {checks.map((check) => (
                <li key={check.id} className="flex items-start gap-1.5">
                  {CHECK_ICON[`${check.ok}`]}
                  <span className={cn(check.ok === false && "text-status-error-text")}>
                    {check.label}
                  </span>
                </li>
              ))}
            </ul>
            {fundsError && <ErrorLine>{fundsError}</ErrorLine>}
          </div>

          <SoftButton
            dark
            className="h-10 w-full px-5 sm:w-auto"
            onClick={() => void approve()}
            disabled={!ready || buy.running}
          >
            Approve &amp; buy {formatUsd(total)}
          </SoftButton>
        </>
      )}
    </Ticket>
  );
}

/** Each bought (or attempted) item with its status, amount received and Solscan link. */
function PurchaseList({ items }: { items: BuyItem[] }) {
  return (
    <ul className="divide-y divide-soft">
      {items.map((item) => (
        <li key={item.symbol} className="py-3 first:pt-0">
          <RevealRow className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-text-extra-high">{item.symbol}</span>{" "}
              <span className="text-[12.5px] text-ink-muted">
                {item.name} · {formatUsd(item.usdcAmount)}
              </span>
              {item.error && <ErrorLine className="mt-1">{item.error}</ErrorLine>}
            </div>
            <div className="text-right text-[12.5px]">
              <SwapStatus step={item.step} />
              {item.step === "bought" && item.outAmount && (
                <div className="text-ink-muted tabular-nums">
                  +{formatBaseUnits(item.outAmount, item.decimals)} {item.symbol}
                </div>
              )}
              <AnimatePresence>
                {item.signature && <SolscanLink key="solscan" signature={item.signature} />}
              </AnimatePresence>
            </div>
          </RevealRow>
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
    <li className="py-3 first:pt-0">
      <RevealRow className="space-y-2">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
          <div className="min-w-0 flex-1 basis-44">
            <ItemName item={item} />
            <p className="mt-0.5 text-[12.5px] text-ink-muted">{item.reason}</p>
          </div>
          <label className="flex h-8 items-center gap-1 rounded-full bg-soft pr-3 pl-3 transition-[background-color,box-shadow] focus-within:bg-white focus-within:shadow-hairline">
            <span className="sr-only">USDC amount for {item.symbol}</span>
            <input
              inputMode="decimal"
              value={item.amountText}
              onChange={(e) => onAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="w-16 bg-transparent text-right text-[13.5px] text-text-extra-high tabular-nums outline-none"
            />
            <span className="text-[12px] text-ink-muted">USDC</span>
          </label>
          <IconButton
            onClick={onRemove}
            disabled={!canRemove}
            aria-label={`Remove ${item.symbol}`}
            className="size-8 [&_svg]:size-3.5"
          >
            <X />
          </IconButton>
        </div>

        {loading && (
          <span
            className="flex w-full items-center gap-3"
            role="status"
            aria-label="Getting a quote"
          >
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
          </span>
        )}
        <AnimatePresence initial={false}>
          {q && (
            <Expand key="quote">
              <div className="grid grid-cols-3 gap-2 rounded-[14px] bg-soft p-3 text-[12.5px] tabular-nums">
                <RevealRow>
                  <p className="text-ink-muted">You get</p>
                  <p className="mt-0.5 font-medium text-text-extra-high">
                    ≈{" "}
                    <RollText
                      value={q.expectedOut.toLocaleString("en-US", { maximumSignificantDigits: 6 })}
                    />{" "}
                    {q.symbol}
                  </p>
                </RevealRow>
                <RevealRow>
                  <p className="text-ink-muted">Price impact</p>
                  <p className="mt-0.5 font-medium text-text-extra-high">
                    <RollText value={describePriceImpact(q.priceImpactPct).text} />
                  </p>
                </RevealRow>
                <RevealRow>
                  <p className="text-ink-muted">Fees</p>
                  <p className="mt-0.5 font-medium text-text-extra-high">
                    {[
                      q.feeBps !== null ? `${(q.feeBps / 100).toFixed(2)}%` : null,
                      q.gasless
                        ? "gasless"
                        : q.networkFeesSol !== null
                          ? `${q.networkFeesSol.toFixed(5)} SOL`
                          : null,
                    ]
                      .filter(Boolean)
                      .join(" + ") || "unknown"}
                  </p>
                </RevealRow>
              </div>
            </Expand>
          )}
        </AnimatePresence>

        {warnings.length > 0 && (
          <ul className="space-y-0.5">
            {warnings.map((w) =>
              w.severity === "block" ? (
                // The one error line for this item: red, with a single warning icon.
                <li key={w.kind}>
                  <ErrorLine>{w.message}</ErrorLine>
                </li>
              ) : (
                <li
                  key={w.kind}
                  className="flex items-start gap-1 text-[12.5px] text-status-warning-text"
                >
                  <Info className="mt-0.5 size-3 shrink-0" aria-hidden /> {w.message}
                </li>
              ),
            )}
          </ul>
        )}
      </RevealRow>
    </li>
  );
}

/** The transaction on Solscan, sliding in once the swap has a signature. */
function SolscanLink({ signature }: { signature: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.a
      href={solscanTxUrl(signature, "mainnet-beta")}
      target="_blank"
      rel="noreferrer"
      initial={reduce ? false : { opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 40 }}
      className="mt-1 inline-flex items-center gap-0.5 font-medium text-text-extra-high underline-offset-4 hover:underline"
    >
      Solscan <ExternalLink className="size-3" />
    </motion.a>
  );
}

/** One short error line: red, with a single warning icon. Friendly text only. */
function ErrorLine({ children, className }: { children: string; className?: string }) {
  return (
    <p
      role="alert"
      className={cn("flex items-start gap-1.5 text-[12.5px] text-status-error-text", className)}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** A plan item's token, company and issuer, as the plan names them. */
function ItemName({ item }: { item: AcceptedPlan["items"][number] }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold text-text-extra-high">{item.symbol}</span>
      <span className="text-text-high">{item.name}</span>
      {item.issuer && (
        <span className="inline-flex h-5 items-center rounded-full bg-soft px-2 text-[11px] font-medium text-ink-muted">
          {item.issuer}
        </span>
      )}
    </span>
  );
}
