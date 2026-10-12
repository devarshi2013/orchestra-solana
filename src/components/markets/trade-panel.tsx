"use client";

import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { ArrowLeft, ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { issuerLabel } from "@/components/market/stock-figures";
import { StrategyForm } from "@/components/profile/strategy-form";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ConnectWalletButton, useWallet } from "@/components/wallet";
import { getJson, logUnlessAborted } from "@/hooks/use-markets";
import { useTrade, type TradeSide, type TradeStep } from "@/hooks/use-trade";
import type { Stock, StockToken } from "@/lib/stocks/types";
import { describePriceImpact } from "@/lib/swap/quote";
import { MIN_ORDER_USD, toUnits, USDC_DECIMALS } from "@/lib/units";

import { TokenSelect } from "./token-select";

const fmt = (n: number, max = 6) => n.toLocaleString("en-US", { maximumFractionDigits: max });

const MODES = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "strategy", label: "Strategy" },
] as const;
type Mode = (typeof MODES)[number]["value"];

const SPRING: Transition = { type: "spring", stiffness: 400, damping: 35, mass: 0.8 };
const INSTANT: Transition = { duration: 0 };

/**
 * Buy or sell one of a company's tokens for USDC: pick the token, see a live
 * Jupiter quote, review, then sign in your own wallet. Each step reveals as a
 * card that opens from the top; numbers roll in as quotes change.
 */
export function TradePanel({
  stock,
  token,
  onTokenChange,
}: {
  stock: Stock;
  token: StockToken;
  onTokenChange: (token: StockToken) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const { publicKey } = useWallet();
  const [mode, setMode] = useState<Mode>("buy");
  const [created, setCreated] = useState(false);
  const side: TradeSide = mode === "sell" ? "sell" : "buy";
  const [text, setText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [loaded, setLoaded] = useState<{ key: string; usdc: number; token: number } | null>(null);
  const [balanceLoads, setBalanceLoads] = useState(0);
  // A strategy isn't a trade now: nothing is quoted while it's being set.
  const amount = mode !== "strategy" && Number(text) > 0 ? Number(text) : 0;
  const trade = useTrade({ side, mint: token.mint, decimals: token.decimals, amount });

  const wallet = publicKey?.toBase58() ?? null;
  // Balances belong to one wallet and token; another pair's are never shown.
  const balanceKey = `${wallet}:${token.mint}`;
  const balances = loaded?.key === balanceKey ? loaded : null;
  useEffect(() => {
    if (!wallet) return;
    const abort = new AbortController();
    getJson<{ usdc: number; token: number }>(
      `/api/markets/balance?${new URLSearchParams({ wallet, mint: token.mint })}`,
      abort.signal,
    )
      .then((b) => setLoaded({ key: `${wallet}:${token.mint}`, ...b }))
      .catch(logUnlessAborted(abort.signal, "[trade] balance failed"));
    return () => abort.abort();
  }, [wallet, token.mint, balanceLoads]);

  const q = trade.quote;
  const buying = side === "buy";
  const received = q ? toUnits(q.outAmount, buying ? token.decimals : USDC_DECIMALS) : null;
  const held = buying ? balances?.usdc : balances?.token;
  const usdc = (n: number) => `${fmt(n, 2)} USDC`;
  const tokens = (n: number) => `${fmt(n)} ${token.symbol}`;
  const [pay, receive] = buying ? [usdc, tokens] : [tokens, usdc];
  const fee = q?.feeBps != null ? `${(q.feeBps / 100).toFixed(2)}%` : "—";
  const impact = q ? describePriceImpact(q.priceImpact).text : "—";
  const tooSmall = buying && amount > 0 && amount < MIN_ORDER_USD;
  const tooMuch = held !== undefined && amount > held + 1e-9;
  const problem = tooSmall
    ? `Minimum trade is $${MIN_ORDER_USD}.`
    : tooMuch
      ? `Not enough ${buying ? "USDC" : token.symbol} for this trade.`
      : trade.quoteError;
  const canReview = Boolean(q && !problem && trade.connected);
  const busy = trade.step === "signing" || trade.step === "sending";
  const view =
    mode === "strategy"
      ? created
        ? "created"
        : "strategy"
      : trade.step === "done"
        ? "done"
        : reviewing && q
          ? "review"
          : "form";

  const restart = () => {
    setText("");
    setReviewing(false);
    trade.reset();
  };
  const finish = () => {
    restart();
    setBalanceLoads((n) => n + 1);
  };

  return (
    <motion.section
      layout={!reduce}
      transition={reduce ? INSTANT : SPRING}
      aria-label={`Trade ${stock.ticker}`}
      className="overflow-hidden rounded-[24px] bg-white p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_1px_1px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)]"
    >
      <motion.div layout={!reduce ? "position" : false}>
        <SegmentedControl
          aria-label="Trade"
          className="grid w-full grid-cols-3"
          items={MODES}
          value={mode}
          disabled={busy}
          onValueChange={(next) => {
            setMode(next);
            setCreated(false);
            restart();
          }}
        />
      </motion.div>

      <AnimatePresence mode="popLayout" initial={false}>
        <Reveal key={view} reduce={reduce}>
          {view === "strategy" ? (
            <div className="space-y-3 px-1 pt-3 pb-1">
              {stock.tokens.length > 1 && (
                <TokenSelect tokens={stock.tokens} value={token.mint} onChange={onTokenChange} />
              )}
              <StrategyForm
                key={token.mint}
                token={{ ...token, name: stock.name }}
                hideToken={stock.tokens.length > 1}
                onCreated={() => setCreated(true)}
              />
            </div>
          ) : view === "created" ? (
            <div
              className="flex flex-col items-center gap-3 px-2 pt-6 pb-2 text-center"
              role="status"
            >
              <DrawnCheck reduce={reduce} />
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-text-extra-high">
                Strategy created
              </p>
              <Link
                href="/portfolio#strategies"
                className="text-[13px] font-medium text-[#868593] hover:text-text-extra-high"
              >
                View in portfolio
              </Link>
              <Button variant="outline" className="mt-2 w-full" onClick={() => setCreated(false)}>
                New strategy
              </Button>
            </div>
          ) : view === "done" ? (
            <div
              className="flex flex-col items-center gap-3 px-2 pt-6 pb-2 text-center"
              role="status"
            >
              <DrawnCheck reduce={reduce} />
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-text-extra-high">
                Trade complete
              </p>
              {trade.signature && (
                <motion.a
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? INSTANT : { ...SPRING, delay: 0.25 }}
                  href={`https://solscan.io/tx/${trade.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-[#868593] hover:text-text-extra-high"
                >
                  View on Solscan <ExternalLink className="size-3.5" aria-hidden />
                </motion.a>
              )}
              <Button variant="outline" className="mt-2 w-full" onClick={finish}>
                New trade
              </Button>
            </div>
          ) : view === "review" && q ? (
            <div className="space-y-3 px-1 pt-3 pb-1">
              <button
                type="button"
                onClick={() => setReviewing(false)}
                disabled={busy}
                className="inline-flex items-center gap-1 px-1 text-[12.5px] font-medium text-[#868593] hover:text-text-extra-high disabled:opacity-50"
              >
                <ArrowLeft className="size-3.5" aria-hidden /> Edit
              </button>
              <dl className="rounded-[16px] bg-[#F4F4F9] px-3 py-1 text-[14px]">
                {(
                  [
                    ["You pay", pay(amount)],
                    ["You receive", `≈ ${receive(received ?? 0)}`],
                    ["Price impact", impact],
                    ["Fee", fee],
                    ["Token", `${token.symbol} · ${issuerLabel(token.issuer)}`],
                  ] as const
                ).map(([label, value], i) => (
                  <StaggerRow key={label} index={i} reduce={reduce} label={label} value={value} />
                ))}
              </dl>
              {trade.error && <ErrorLine>{trade.error}</ErrorLine>}
              <Button
                className="w-full"
                size="lg"
                onClick={() => void trade.execute()}
                disabled={busy}
              >
                <Status step={trade.step} reduce={reduce} />
              </Button>
            </div>
          ) : (
            <div className="space-y-3 px-1 pt-3 pb-1">
              {stock.tokens.length > 1 && (
                <TokenSelect
                  tokens={stock.tokens}
                  value={token.mint}
                  disabled={busy}
                  onChange={(next) => {
                    onTokenChange(next);
                    restart();
                  }}
                />
              )}
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between px-1 text-[12.5px] font-medium text-[#868593]">
                  {buying ? "You pay" : "You sell"}
                  {held !== undefined && (
                    <button
                      type="button"
                      onClick={() => setText(String(held))}
                      className="tabular-nums hover:text-text-extra-high"
                    >
                      Balance {fmt(held, buying ? 2 : 6)}
                    </button>
                  )}
                </span>
                <span className="flex items-center rounded-[16px] bg-[#F4F4F9] px-4 transition-[background-color,box-shadow] focus-within:bg-white focus-within:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)]">
                  <input
                    inputMode="decimal"
                    value={text}
                    onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0.00"
                    className="h-12 min-w-0 flex-1 bg-transparent text-lg font-medium text-text-extra-high tabular-nums outline-none placeholder:text-[#B9B8C3]"
                    aria-label={`${buying ? "USDC" : token.symbol} amount`}
                  />
                  <span className="text-[13px] font-medium text-[#868593]">
                    {buying ? "USDC" : token.symbol}
                  </span>
                </span>
              </label>

              <AnimatePresence initial={false}>
                {amount > 0 && (
                  <motion.dl
                    key="quote"
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={reduce ? INSTANT : SPRING}
                    className="overflow-hidden px-1 text-[13.5px]"
                  >
                    {(
                      [
                        [
                          "You receive",
                          trade.quoting ? "…" : received !== null ? `≈ ${receive(received)}` : "—",
                        ],
                        ["Fee", fee],
                        ["Price impact", impact],
                      ] as const
                    ).map(([label, value], i) => (
                      <StaggerRow
                        key={label}
                        index={i}
                        reduce={reduce}
                        label={label}
                        value={value}
                      />
                    ))}
                  </motion.dl>
                )}
              </AnimatePresence>

              {problem && <ErrorLine>{problem}</ErrorLine>}

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
                <ConnectWalletButton size="lg" className="w-full" />
              )}
            </div>
          )}
        </Reveal>
      </AnimatePresence>
    </motion.section>
  );
}

/** One step of the panel, opening downward from the top edge as it replaces the last. */
function Reveal({ reduce, children }: { reduce: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={reduce ? false : { clipPath: "inset(0 0 100% 0 round 20px)", opacity: 0, y: -6 }}
      animate={{ clipPath: "inset(0 0 0% 0 round 20px)", opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
      transition={reduce ? INSTANT : SPRING}
    >
      {children}
    </motion.div>
  );
}

/** A label / value row that slides in after the ones above it; its value rolls when it changes. */
function StaggerRow({
  index,
  reduce,
  label,
  value,
}: {
  index: number;
  reduce: boolean;
  label: string;
  value: string;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? INSTANT : { ...SPRING, delay: 0.035 * index }}
      className="flex items-center justify-between gap-3 py-1.5"
    >
      <dt className="text-[#868593]">{label}</dt>
      <dd className="relative overflow-hidden text-right font-medium text-text-extra-high tabular-nums">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            className="inline-block"
            initial={reduce ? false : { y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: "-100%", opacity: 0 }}
            transition={reduce ? INSTANT : SPRING}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </dd>
    </motion.div>
  );
}

const STATUS: Record<TradeStep, string> = {
  idle: "Approve in wallet",
  signing: "Approve in your wallet…",
  sending: "Sending…",
  done: "Confirmed",
  failed: "Try again",
};

/** The execute button's label, morphing in place from step to step. */
function Status({ step, reduce }: { step: TradeStep; reduce: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={step}
        className="inline-flex items-center gap-2"
        initial={reduce ? false : { y: 12, opacity: 0, filter: "blur(2px)" }}
        animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
        exit={reduce ? undefined : { y: -12, opacity: 0, filter: "blur(2px)" }}
        transition={reduce ? INSTANT : SPRING}
      >
        {(step === "signing" || step === "sending") && <Loader2 className="animate-spin" />}
        {STATUS[step]}
      </motion.span>
    </AnimatePresence>
  );
}

/** A check in a circle that draws itself. */
function DrawnCheck({ reduce }: { reduce: boolean }) {
  return (
    <motion.svg
      viewBox="0 0 48 48"
      className="size-12 text-emerald-600"
      initial={reduce ? false : { scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={reduce ? INSTANT : SPRING}
      aria-hidden
    >
      <circle cx="24" cy="24" r="22" className="fill-emerald-50" />
      <motion.path
        d="M15 24.5l6.5 6.5L33 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? INSTANT : { duration: 0.35, delay: 0.1, ease: [0.65, 0, 0.35, 1] }}
      />
    </motion.svg>
  );
}

function ErrorLine({ children }: { children: string }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 px-1 text-[12.5px] text-status-error-text">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
