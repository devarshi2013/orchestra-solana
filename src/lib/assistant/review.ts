import { MAX_TEST_QUOTE_IMPACT_PCT } from "@/lib/assets/config";
import type { SwapQuote } from "@/lib/assets/tools";
import { MIN_ORDER_USD } from "@/lib/units";
import { formatUsd } from "@/lib/format";

import { describeClosedMarket, usMarketSession } from "./market-hours";

/**
 * Review of an assistant plan before buying: per-item warnings from a fresh
 * Jupiter quote, and the pre-flight checks that gate "Approve & buy". Pure, so
 * the plan card re-evaluates them as amounts, quotes, balances and time change.
 */

export type ItemKind = "stock" | "crypto";

/** A fresh quote for one plan item, from POST /api/assistant/quote. */
export type ItemQuote = {
  symbol: string;
  quote: SwapQuote | null;
  /** Why there's no quote. */
  reason: string | null;
  /** Pool liquidity from the registry, USD (null for most stocks). */
  liquidityUsd: number | null;
  /** The issuer's trading schedule, stocks only. */
  hours: string | null;
};

/** Price impact (absolute %) from which a buy is flagged. */
export const HIGH_IMPACT_PCT = MAX_TEST_QUOTE_IMPACT_PCT;
/** Price impact (absolute %) that's a severe cost. */
export const SEVERE_IMPACT_PCT = 5;
/** A buy above this share of the pool's liquidity is flagged as thin. */
export const THIN_LIQUIDITY_SHARE = 0.02;
/** Network fee assumed per non-gasless swap when Jupiter doesn't say, SOL. */
export const FALLBACK_FEE_SOL = 0.005;

export type ItemWarning = {
  kind: "quote" | "impact" | "liquidity" | "market-hours";
  /** "block": the item can't be bought as is. */
  severity: "warn" | "block";
  message: string;
};

export function itemWarnings(
  item: { kind: ItemKind; usdcAmount: number },
  quoted: ItemQuote | undefined,
  now: Date,
): ItemWarning[] {
  const warnings: ItemWarning[] = [];
  const quote = quoted?.quote;
  if (quoted && !quote) {
    warnings.push({
      kind: "quote",
      severity: "block",
      message: `No quote: ${quoted.reason ?? "Jupiter couldn't price this"}`,
    });
  }
  if (quote?.warning) warnings.push({ kind: "quote", severity: "block", message: quote.warning });

  const impact = quote?.priceImpactPct ?? null;
  if (impact !== null && impact >= HIGH_IMPACT_PCT) {
    warnings.push({
      kind: "impact",
      severity: "warn",
      message:
        impact >= SEVERE_IMPACT_PCT
          ? `Very high price impact (${impact.toFixed(2)}%): you'd pay well above the market price. Consider a smaller amount.`
          : `High price impact (${impact.toFixed(2)}%)`,
    });
  }

  const liquidity = quoted?.liquidityUsd ?? null;
  if (
    quote?.thinLiquidity ||
    (liquidity !== null && item.usdcAmount > liquidity * THIN_LIQUIDITY_SHARE)
  ) {
    warnings.push({
      kind: "liquidity",
      severity: "warn",
      message:
        liquidity !== null
          ? `Thin liquidity: ${formatUsd(liquidity)} in the pool for a ${formatUsd(item.usdcAmount)} buy`
          : "Thin liquidity: this size moves the price",
    });
  }

  if (item.kind === "stock") {
    const session = usMarketSession(now);
    if (!session.open) {
      warnings.push({
        kind: "market-hours",
        severity: "warn",
        message: describeClosedMarket(session.reason),
      });
    }
  }
  return warnings;
}

export type PreflightCheck = {
  id: "wallet" | "minimum" | "usdc" | "sol" | "quotes";
  /** null: still checking. */
  ok: boolean | null;
  label: string;
};

/** SOL the wallet needs for network fees (and new token accounts) across the plan. */
export function solNeeded(items: { symbol: string }[], quotes: Map<string, ItemQuote>): number {
  return items.reduce((sum, item) => {
    const quote = quotes.get(item.symbol)?.quote;
    if (quote?.gasless) return sum;
    return sum + (quote?.networkFeesSol ?? FALLBACK_FEE_SOL);
  }, 0);
}

/** The checks that must all pass before "Approve & buy". */
export function preflight(input: {
  wallet: { connected: boolean; canSign: boolean };
  balances: { usdc: number; sol: number } | null;
  items: { symbol: string; kind: ItemKind; usdcAmount: number }[];
  quotes: Map<string, ItemQuote>;
  /** Quotes still loading. */
  quoting: boolean;
  now: Date;
}): PreflightCheck[] {
  const { wallet, balances, items, quotes } = input;
  const total = items.reduce((sum, item) => sum + item.usdcAmount, 0);
  const small = items.filter((item) => !(item.usdcAmount >= MIN_ORDER_USD));
  const sol = solNeeded(items, quotes);
  const blocked = items.filter((item) =>
    itemWarnings(item, quotes.get(item.symbol), input.now).some((w) => w.severity === "block"),
  );
  const unquoted = items.filter((item) => !quotes.has(item.symbol));
  return [
    {
      id: "wallet",
      ok: wallet.connected && wallet.canSign,
      label: !wallet.connected
        ? "Connect your wallet"
        : wallet.canSign
          ? "Wallet connected"
          : "This wallet can't sign transactions (watch-only?)",
    },
    {
      id: "minimum",
      ok: items.length > 0 && small.length === 0,
      label:
        items.length === 0
          ? "Add at least one item"
          : small.length === 0
            ? `Every item is at least ${formatUsd(MIN_ORDER_USD)}`
            : `Minimum order is ${formatUsd(MIN_ORDER_USD)}: raise or remove ${small.map((i) => i.symbol).join(", ")}`,
    },
    {
      id: "usdc",
      ok: balances ? total <= balances.usdc + 1e-9 : null,
      label: balances
        ? total <= balances.usdc + 1e-9
          ? `Enough USDC: ${formatUsd(total)} of ${formatUsd(balances.usdc)}`
          : `Not enough USDC: the plan needs ${formatUsd(total)}, your wallet holds ${formatUsd(balances.usdc)}`
        : "Checking your USDC…",
    },
    {
      id: "sol",
      ok: balances ? balances.sol >= sol : null,
      label: balances
        ? balances.sol >= sol
          ? sol === 0
            ? "No SOL needed for fees (gasless)"
            : `Enough SOL for fees: about ${sol.toFixed(4)} of ${balances.sol.toFixed(4)} SOL`
          : `Not enough SOL for fees: about ${sol.toFixed(4)} SOL needed, your wallet holds ${balances.sol.toFixed(4)}`
        : "Checking your SOL…",
    },
    {
      id: "quotes",
      ok: input.quoting || unquoted.length > 0 ? null : blocked.length === 0,
      label:
        input.quoting || unquoted.length > 0
          ? "Getting fresh quotes…"
          : blocked.length === 0
            ? "Every item has a fresh quote"
            : `Can't buy ${blocked.map((i) => i.symbol).join(", ")} as planned: see the item's warning`,
    },
  ];
}
