import { FRIENDLY_MESSAGES, friendlyError, type FriendlyKind } from "@/lib/friendly-error";
import { TIER_LIMITS } from "@/lib/stocks/sync-core";
import type { SwapQuote } from "@/lib/stocks/tools";
import { MIN_ORDER_USD } from "@/lib/units";
import { formatUsd } from "@/lib/format";

import { describeClosedMarket, usMarketSession } from "./market-hours";

/**
 * Review of an assistant plan before buying: per-item warnings from a fresh
 * Jupiter quote, and the pre-flight checks that gate "Approve & buy". Pure, so
 * the plan card re-evaluates them as amounts, quotes, balances and time change.
 */

export type ItemKind = "stock";

/** The registry token a quote chose (the most liquid one that quoted); its mint is what gets bought. */
export type ChosenToken = {
  symbol: string;
  issuer: string;
  mint: string;
  decimals: number;
  liquidityTier: "high" | "medium" | "low";
  hours: string;
  preIpo: boolean;
};

/** A fresh quote for one plan item, from POST /api/assistant/quote. */
export type ItemQuote = {
  /** What the plan asked for: a company ticker (best issuer) or a token symbol. */
  symbol: string;
  quote: SwapQuote | null;
  /** Why there's no quote: one friendly sentence (lib/friendly-error.ts). */
  reason: string | null;
  /** Which friendly message `reason` is; "rate_limited" is retried by the browser. */
  errorKind?: FriendlyKind | null;
  token: ChosenToken | null;
};

/** Price impact (absolute %) from which a buy is flagged. */
export const HIGH_IMPACT_PCT = TIER_LIMITS.medium;
/** Price impact (absolute %) that's a severe cost. */
export const SEVERE_IMPACT_PCT = 5;
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
  // At most one blocking line per item, always a friendly sentence.
  const blocker = quoteProblem(quoted);
  if (blocker) warnings.push({ kind: "quote", severity: "block", message: blocker });

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

  const token = quoted?.token ?? null;
  if (token?.liquidityTier === "low" || quote?.thinLiquidity) {
    warnings.push({
      kind: "liquidity",
      severity: "warn",
      message:
        token?.liquidityTier === "low"
          ? `Low liquidity: ${token.symbol} moves noticeably even on small buys`
          : `Thin liquidity: ${formatUsd(item.usdcAmount)} moves the price`,
    });
  }

  // Pre-IPO tokens have no public market to be closed; everything else follows US hours.
  if (item.kind === "stock" && !token?.preIpo) {
    const session = usMarketSession(now);
    if (!session.open) {
      warnings.push({
        kind: "market-hours",
        severity: "warn",
        message: describeClosedMarket(),
      });
    }
  }
  return warnings;
}

/** Why an item can't be bought as quoted (one friendly sentence), or null. */
export function quoteProblem(quoted: ItemQuote | undefined): string | null {
  if (!quoted) return null;
  if (!quoted.quote) {
    return friendlyError(
      quoted.errorKind ? { kind: quoted.errorKind } : (quoted.reason ?? FRIENDLY_MESSAGES.no_route),
    );
  }
  return quoted.quote.warning ? friendlyError(quoted.quote.warning) : null;
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
            : cantBuy(
                blocked.map((i) => ({
                  symbol: i.symbol,
                  problem: quoteProblem(quotes.get(i.symbol)),
                })),
              ),
    },
  ];
}

/** "Can't buy BAC right now: <reason>", with one reason when they share it. */
function cantBuy(items: { symbol: string; problem: string | null }[]): string {
  const symbols = items.map((i) => i.symbol).join(", ");
  const reasons = [...new Set(items.map((i) => i.problem).filter(Boolean))];
  return reasons.length === 1
    ? `Can't buy ${symbols} right now: ${reasons[0]}`
    : `Can't buy ${symbols} right now`;
}
