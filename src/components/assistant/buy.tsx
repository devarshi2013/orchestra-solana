"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink, TriangleAlert, X } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useWallet, useWalletModal } from "@/components/wallet";
import { issuerLabel } from "@/components/market/stock-figures";
import { CardReveal, Expand, RevealRow, RollText, SwapStatus } from "@/components/motion";
import { useTrade, type TradeStep } from "@/hooks/use-trade";
import type { BuyStep } from "@/hooks/use-plan-buy";
import type { Buyable } from "@/lib/assistant/buyable";
import { solscanTxUrl } from "@/lib/solana";
import type { StockResponse } from "@/lib/stocks/api";
import type { Stock } from "@/lib/stocks/types";
import { describePriceImpact } from "@/lib/swap/quote";
import { MIN_ORDER_USD, toUnits } from "@/lib/units";
import { cn } from "@/lib/utils";

import { IconButton, SoftButton } from "./controls";

type BuyState = {
  buyable: Buyable;
  /** The open buy card's mark id, or null. */
  open: string | null;
  toggle: (id: string) => void;
};

const BuyContext = createContext<BuyState | null>(null);

/** Buy pills and cards for one reply; `buyable` is what its tool results returned. */
export function BuyProvider({ buyable, children }: { buyable: Buyable; children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));
  return <BuyContext.Provider value={{ buyable, open, toggle }}>{children}</BuyContext.Provider>;
}

const useBuy = () => useContext(BuyContext);

/** The small "Buy" pill next to a token (in prose) or at a table row's end. */
export function BuyPill({ id, name, className }: { id: string; name: string; className?: string }) {
  const buy = useBuy();
  if (!buy) return null;
  const open = buy.open === id;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`Buy ${name}`}
      onClick={() => buy.toggle(id)}
      className={cn(
        "inline-flex h-7 shrink-0 cursor-pointer items-center rounded-full px-2.5 align-middle text-[12.5px] font-medium tracking-[-0.01em] transition-[background-color,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-gray-1200",
        open
          ? "bg-gray-1400 text-white"
          : "bg-soft text-text-extra-high hover:bg-gray-1400 hover:text-white",
        className,
      )}
    >
      Buy
    </button>
  );
}

/** The open card for `id`, if any: rendered under the line or row that holds its pill. */
export function BuySlot({ id, name }: { id: string | undefined; name: string | undefined }) {
  const buy = useBuy();
  if (!buy || !id || !name || buy.open !== id) return null;
  return (
    <BuyCard
      name={name}
      preferred={buy.buyable.get(name)?.[0] ?? name}
      onClose={() => buy.toggle(id)}
    />
  );
}

/** The open card for a table row: a full-width row under it, only while open. */
export function BuyRow({ id, name }: { id: string | undefined; name: string | undefined }) {
  const buy = useBuy();
  if (!buy || !id || buy.open !== id) return null;
  return (
    <tr>
      <td colSpan={100} className="p-0">
        <BuySlot id={id} name={name} />
      </td>
    </tr>
  );
}

/** The company behind `name`, live from the stock universe (the only source of mints). */
function useStock(name: string) {
  const [state, setState] = useState<{ stock: Stock | null; error: string | null } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/stocks/${encodeURIComponent(name)}`, { signal: abort.signal })
      .then(async (response) => {
        if (response.status === 404) return setState({ stock: null, error: "Not listed" });
        if (!response.ok) return setState({ stock: null, error: "Couldn't load this stock" });
        setState({ stock: ((await response.json()) as StockResponse).stock, error: null });
      })
      .catch(() => {
        if (!abort.signal.aborted) setState({ stock: null, error: "Couldn't load this stock" });
      });
    return () => abort.abort();
  }, [name]);
  return state;
}

const STEP: Record<TradeStep, BuyStep | null> = {
  idle: null,
  signing: "signing",
  sending: "sending",
  done: "bought",
  failed: "failed",
};

/**
 * Buying one token inline: USDC amount, a live quote, then the wallet signs
 * the swap (never sends it) and our API lands it, as on the stock page. It
 * opens with the token the tool results favoured; a company with several
 * issuers' tokens can switch.
 */
function BuyCard({
  name,
  preferred,
  onClose,
}: {
  name: string;
  preferred: string;
  onClose: () => void;
}) {
  const loaded = useStock(name);
  return (
    <CardReveal className="my-2 rounded-[20px] bg-white text-[14px] tracking-[-0.01em] shadow-hairline">
      <div className="p-4">
        {!loaded ? (
          <RevealRow className="h-24 animate-pulse rounded-[14px] bg-soft" />
        ) : loaded.stock ? (
          <BuyForm stock={loaded.stock} preferred={preferred} onClose={onClose} />
        ) : (
          <RevealRow className="flex items-center justify-between gap-3">
            <p className="text-status-error-text">{loaded.error}</p>
            <IconButton onClick={onClose} aria-label="Close">
              <X />
            </IconButton>
          </RevealRow>
        )}
      </div>
    </CardReveal>
  );
}

function BuyForm({
  stock,
  preferred,
  onClose,
}: {
  stock: Stock;
  preferred: string;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const { connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [symbol, setSymbol] = useState(
    stock.tokens.some((t) => t.symbol === preferred) ? preferred : stock.tokens[0]!.symbol,
  );
  const token = stock.tokens.find((t) => t.symbol === symbol) ?? stock.tokens[0]!;
  const [amountText, setAmountText] = useState("10");
  const amount = Number(amountText) > 0 ? Number(amountText) : 0;
  const trade = useTrade({ side: "buy", mint: token.mint, decimals: token.decimals, amount });
  const q = trade.quote;
  const received = q ? toUnits(q.outAmount, token.decimals) : null;
  const tooSmall = amount > 0 && amount < MIN_ORDER_USD;
  const working = trade.step === "signing" || trade.step === "sending";
  const status = STEP[trade.step];

  return (
    <div className="space-y-3">
      <RevealRow className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-text-extra-high">{token.symbol}</span>{" "}
          <span className="text-ink-muted">
            {stock.name}
            {token.issuer && ` · ${issuerLabel(token.issuer)}`}
          </span>
        </p>
        <IconButton onClick={onClose} aria-label="Close" className="-my-1 size-7 [&_svg]:size-3.5">
          <X />
        </IconButton>
      </RevealRow>

      {stock.tokens.length > 1 && (
        <RevealRow role="radiogroup" aria-label="Issuer" className="flex flex-wrap gap-1">
          {stock.tokens.map((t) => (
            <button
              key={t.mint}
              type="button"
              role="radio"
              aria-checked={t.symbol === symbol}
              disabled={working}
              onClick={() => {
                setSymbol(t.symbol);
                trade.reset();
              }}
              className={cn(
                "h-7 cursor-pointer rounded-full px-2.5 text-[12.5px] font-medium transition-[background-color,box-shadow,color] outline-none focus-visible:ring-2 focus-visible:ring-gray-1200",
                t.symbol === symbol
                  ? "bg-white text-text-extra-high shadow-hairline"
                  : "bg-soft text-ink-muted hover:text-text-extra-high",
              )}
            >
              {t.symbol}
            </button>
          ))}
        </RevealRow>
      )}

      <RevealRow className="flex items-center gap-2">
        <label className="flex h-10 flex-1 items-center gap-1.5 rounded-full bg-soft pr-4 pl-4 transition-[background-color,box-shadow] focus-within:bg-white focus-within:shadow-hairline">
          <span className="sr-only">USDC to spend</span>
          <input
            inputMode="decimal"
            value={amountText}
            disabled={working}
            onChange={(e) => {
              setAmountText(e.target.value.replace(/[^\d.]/g, "").slice(0, 9));
              trade.reset();
            }}
            className="w-full min-w-0 bg-transparent text-[15px] text-text-extra-high tabular-nums outline-none"
          />
          <span className="text-[12.5px] text-ink-muted">USDC</span>
        </label>
        {connected ? (
          <SoftButton
            dark
            className="h-10 px-5"
            disabled={!q || tooSmall || working || trade.step === "done"}
            onClick={() => void trade.execute()}
          >
            Buy
          </SoftButton>
        ) : (
          <SoftButton dark className="h-10 px-5" onClick={() => setVisible(true)}>
            Connect wallet
          </SoftButton>
        )}
      </RevealRow>

      <AnimatePresence initial={false}>
        {q && !tooSmall && (
          <Expand key="quote">
            <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-soft p-3 text-[12.5px] tabular-nums">
              <RevealRow>
                <p className="text-ink-muted">You get</p>
                <p className="mt-0.5 font-medium text-text-extra-high">
                  ≈{" "}
                  <RollText
                    value={(received ?? 0).toLocaleString("en-US", { maximumSignificantDigits: 6 })}
                  />{" "}
                  {token.symbol}
                </p>
              </RevealRow>
              <RevealRow>
                <p className="text-ink-muted">Price impact</p>
                <p className="mt-0.5 font-medium text-text-extra-high">
                  <RollText value={describePriceImpact(q.priceImpact).text} />
                </p>
              </RevealRow>
            </div>
          </Expand>
        )}
      </AnimatePresence>

      {trade.quoting && !tooSmall && (
        <p role="status" className="text-shimmer text-[12.5px]">
          Getting a quote…
        </p>
      )}
      {tooSmall && <p className="text-[12.5px] text-ink-muted">Minimum {MIN_ORDER_USD} USDC</p>}
      {(trade.quoteError || trade.error) && (
        <p role="alert" className="flex items-start gap-1.5 text-[12.5px] text-status-error-text">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {trade.error ?? trade.quoteError}
        </p>
      )}

      {status && (
        <div className="flex items-center justify-end gap-3 text-[12.5px]">
          <SwapStatus step={status} />
          <AnimatePresence>
            {trade.signature && (
              <motion.a
                key="solscan"
                href={solscanTxUrl(trade.signature, "mainnet-beta")}
                target="_blank"
                rel="noreferrer"
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={
                  reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 40 }
                }
                className="inline-flex items-center gap-0.5 font-medium text-text-extra-high underline-offset-4 hover:underline"
              >
                Solscan <ExternalLink className="size-3" />
              </motion.a>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
