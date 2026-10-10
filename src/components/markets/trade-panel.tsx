"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet/wallet-button";
import { getJson } from "@/hooks/use-markets";
import { useNow } from "@/hooks/use-now";
import { useTrade, type TradeSide } from "@/hooks/use-trade";
import { describeClosedMarket, usMarketSession } from "@/lib/assistant/market-hours";
import { describePriceImpact } from "@/lib/swap/quote";
import { USDC_DECIMALS, MIN_ORDER_USD, toUnits } from "@/lib/units";
import { cn } from "@/lib/utils";

export type TradeToken = {
  ticker: string;
  symbol: string;
  issuer: string;
  mint: string;
  decimals: number;
  preIpo: boolean;
};

const fmt = (n: number, max = 6) => n.toLocaleString("en-US", { maximumFractionDigits: max });

/**
 * Buy or sell one stock token for USDC. Shows a live quote (tokens or USDC
 * received, Jupiter's fee, price impact), then "Review trade" → a summary →
 * the user signs in their own wallet → Quill lands the trade. Below it, a
 * link to research the stock with Quill.
 */
export function TradePanel({ token }: { token: TradeToken }) {
  const { publicKey } = useWallet();
  const [side, setSide] = useState<TradeSide>("buy");
  const [text, setText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [balances, setBalances] = useState<{ usdc: number; token: number } | null>(null);
  const [balanceLoads, setBalanceLoads] = useState(0);
  const amount = Number(text) > 0 ? Number(text) : 0;
  const trade = useTrade({ side, mint: token.mint, decimals: token.decimals, amount });

  const wallet = publicKey?.toBase58() ?? null;
  useEffect(() => {
    if (!wallet) return;
    const abort = new AbortController();
    getJson<{ usdc: number; token: number }>(
      `/api/markets/balance?wallet=${wallet}&mint=${token.mint}`,
      abort.signal,
    )
      .then(setBalances)
      .catch((e: unknown) => {
        if (!abort.signal.aborted) console.error("[trade] balance failed", e);
      });
    return () => abort.abort();
  }, [wallet, token.mint, balanceLoads]);

  // 0 while the page is being rendered on the server: no notice until the browser knows the time.
  const now = useNow();
  const closedNotice =
    now > 0 && !token.preIpo && !usMarketSession(new Date(now)).open
      ? describeClosedMarket()
      : null;

  const q = trade.quote;
  const received = q ? toUnits(q.outAmount, side === "buy" ? token.decimals : USDC_DECIMALS) : null;
  const held = side === "buy" ? balances?.usdc : balances?.token;
  const tooSmall = side === "buy" && amount > 0 && amount < MIN_ORDER_USD;
  const tooMuch = held !== undefined && amount > held + 1e-9;
  const problem = tooSmall
    ? `Minimum trade is $${MIN_ORDER_USD}.`
    : tooMuch
      ? side === "buy"
        ? "Not enough USDC for this trade."
        : `Not enough ${token.symbol} for this trade.`
      : trade.quoteError;
  const canReview = Boolean(q && !problem && trade.connected);
  const busy = trade.step === "signing" || trade.step === "sending";

  const switchSide = (next: TradeSide) => {
    setSide(next);
    setText("");
    setReviewing(false);
    trade.reset();
  };

  const finish = () => {
    setReviewing(false);
    setText("");
    trade.reset();
    setBalanceLoads((n) => n + 1);
  };

  return (
    <div className="space-y-3">
      <section
        aria-label={`Trade ${token.ticker}`}
        className="rounded-2xl border bg-card p-4 sm:p-5"
      >
        <div
          role="tablist"
          aria-label="Side"
          className="grid grid-cols-2 gap-1 rounded-xl bg-surface-raised p-1"
        >
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={side === s}
              disabled={busy}
              onClick={() => switchSide(s)}
              className={cn(
                "rounded-lg py-2 text-sm font-semibold capitalize transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                side === s
                  ? s === "buy"
                    ? "bg-gain/15 text-gain"
                    : "bg-loss/15 text-loss"
                  : "text-muted-foreground hover:text-white",
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {trade.step === "done" ? (
          <div className="space-y-4 py-6 text-center" role="status">
            <ShieldCheck className="mx-auto size-10 text-gain" aria-hidden />
            <p className="font-semibold">Trade complete</p>
            {trade.signature && (
              <a
                href={`https://solscan.io/tx/${trade.signature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[var(--label-blue)] hover:underline"
              >
                View on Solscan <ExternalLink className="size-3.5" aria-hidden />
              </a>
            )}
            <Button variant="outline" className="w-full" onClick={finish}>
              New trade
            </Button>
          </div>
        ) : reviewing && q ? (
          <div className="mt-4 space-y-4">
            <button
              type="button"
              onClick={() => setReviewing(false)}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-white"
            >
              <ArrowLeft className="size-3.5" aria-hidden /> Edit
            </button>
            <h3 className="text-base font-semibold">Review trade</h3>
            <dl className="divide-y rounded-xl border text-sm">
              <Row label="You pay">
                {side === "buy" ? `${fmt(amount, 2)} USDC` : `${fmt(amount)} ${token.symbol}`}
              </Row>
              <Row label="You receive (est.)">
                {side === "buy"
                  ? `≈ ${fmt(received ?? 0)} ${token.symbol}`
                  : `≈ ${fmt(received ?? 0, 2)} USDC`}
              </Row>
              <Row label="Price impact">{describePriceImpact(q.priceImpact).text}</Row>
              <Row label="Jupiter fee">
                {q.feeBps != null ? `${(q.feeBps / 100).toFixed(2)}%` : "—"}
              </Row>
              <Row label="Token">
                {token.symbol} · {token.issuer}
              </Row>
            </dl>
            <p className="text-xs text-muted-foreground">
              Your wallet will ask you to approve this trade. Quill places it only after you sign.
            </p>
            {trade.error && <ErrorLine>{trade.error}</ErrorLine>}
            <Button
              className="w-full"
              size="lg"
              onClick={() => void trade.execute()}
              disabled={busy}
            >
              {busy ? (
                <>
                  <Loader2 className="animate-spin" />
                  {trade.step === "signing" ? "Approve in your wallet…" : "Placing your trade…"}
                </>
              ) : trade.step === "failed" ? (
                "Try again"
              ) : (
                "Approve in wallet"
              )}
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <label className="block space-y-1.5">
              <span className="flex items-center justify-between text-xs text-muted-foreground">
                {side === "buy" ? "You pay" : "You sell"}
                {held !== undefined && (
                  <button
                    type="button"
                    onClick={() => setText(String(held))}
                    className="font-mono hover:text-white"
                  >
                    Balance {fmt(held, side === "buy" ? 2 : 6)}
                  </button>
                )}
              </span>
              <span className="flex items-center rounded-xl border border-input bg-background px-3 focus-within:border-[var(--label-blue)]">
                <input
                  inputMode="decimal"
                  value={text}
                  onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.00"
                  className="h-12 min-w-0 flex-1 bg-transparent font-mono text-lg tabular-nums outline-none placeholder:text-muted-foreground/60"
                  aria-label={side === "buy" ? "USDC amount" : `${token.symbol} amount`}
                />
                <span className="text-sm font-medium text-muted-foreground">
                  {side === "buy" ? "USDC" : token.symbol}
                </span>
              </span>
            </label>

            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">You receive (est.)</dt>
                <dd className="font-mono tabular-nums">
                  {trade.retrying
                    ? "Retrying…"
                    : trade.quoting
                      ? "…"
                      : received !== null
                        ? side === "buy"
                          ? `≈ ${fmt(received)} ${token.symbol}`
                          : `≈ ${fmt(received, 2)} USDC`
                        : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Fee</dt>
                <dd className="font-mono tabular-nums">
                  {q?.feeBps != null ? `${(q.feeBps / 100).toFixed(2)}%` : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Price impact</dt>
                <dd className="font-mono tabular-nums">
                  {q ? describePriceImpact(q.priceImpact).text : "—"}
                </dd>
              </div>
            </dl>

            {problem && <ErrorLine>{problem}</ErrorLine>}
            {closedNotice && <p className="text-xs text-muted-foreground">{closedNotice}</p>}

            {trade.connected ? (
              <Button
                className="w-full"
                size="lg"
                disabled={!canReview || !trade.canSign}
                onClick={() => setReviewing(true)}
              >
                Review trade
              </Button>
            ) : (
              <div className="[&_.wallet-adapter-button]:h-12 [&_.wallet-adapter-button]:w-full [&_.wallet-adapter-button]:justify-center [&_.wallet-adapter-dropdown]:w-full">
                <WalletButton />
              </div>
            )}
          </div>
        )}
      </section>

      <Button asChild variant="outline" className="w-full">
        <Link href={`/chat?q=${encodeURIComponent(`Tell me about ${token.ticker}`)}`}>
          <Sparkles /> Ask Quill about {token.ticker}
        </Link>
      </Button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono tabular-nums">{children}</dd>
    </div>
  );
}

function ErrorLine({ children }: { children: string }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
