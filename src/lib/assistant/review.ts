import { FRIENDLY_MESSAGES, friendlyError, type FriendlyKind } from "@/lib/friendly-error";
import type { TokenQuote } from "@/lib/stocks/tools";
import type { StockToken } from "@/lib/stocks/types";
import { MIN_ORDER_USD } from "@/lib/units";
import { formatUsd } from "@/lib/format";

/**
 * Review of an assistant plan before buying: per-item warnings from a fresh
 * Jupiter quote, and the pre-flight checks that gate "Approve & buy". Pure, so
 * the plan card re-evaluates them as amounts, quotes and balances change.
 */

export type ItemKind = "stock";

/** The token a plan item buys, with its issuer's label; its mint is what gets bought. */
type QuotedTokenInfo = Pick<StockToken, "symbol" | "mint" | "decimals"> & {
  issuer: string | null;
};

/** A fresh quote for one plan item, from POST /api/assistant/quote. */
export type ItemQuote = {
  /** The token symbol the plan names. */
  symbol: string;
  quote: TokenQuote | null;
  /** Why there's no quote: one friendly sentence (lib/friendly-error.ts). */
  reason: string | null;
  /** Which friendly message `reason` is. */
  errorKind?: FriendlyKind | null;
  token: QuotedTokenInfo | null;
};

/** Price impact (absolute %) from which a buy is flagged. */
const HIGH_IMPACT_PCT = 1;
/** Price impact (absolute %) that's a severe cost. */
const SEVERE_IMPACT_PCT = 5;

export type ItemWarning = {
  kind: "quote" | "impact";
  /** "block": the item can't be bought as is. */
  severity: "warn" | "block";
  message: string;
};

export function itemWarnings(quoted: ItemQuote | undefined): ItemWarning[] {
  const warnings: ItemWarning[] = [];
  // At most one blocking line per item, always a friendly sentence.
  const blocker = quoteProblem(quoted);
  if (blocker) warnings.push({ kind: "quote", severity: "block", message: blocker });

  const impact = quoted?.quote?.priceImpactPct ?? null;
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
  return warnings;
}

/** Why an item can't be bought as quoted (one friendly sentence), or null. */
function quoteProblem(quoted: ItemQuote | undefined): string | null {
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

/**
 * SOL the wallet needs for network fees (and new token accounts) across the
 * plan, from the quotes' fees; `unknown` lists the items whose quote is
 * missing or didn't report its fees (then `sol` is only a partial sum).
 */
function solNeeded(items: { symbol: string }[], quotes: Map<string, ItemQuote>) {
  const unknown: string[] = [];
  let sol = 0;
  for (const item of items) {
    const quote = quotes.get(item.symbol)?.quote;
    if (quote?.gasless) continue;
    if (quote?.networkFeesSol == null) unknown.push(item.symbol);
    else sol += quote.networkFeesSol;
  }
  return { sol, unknown };
}

/** The checks that must all pass before "Approve & buy". */
export function preflight(input: {
  wallet: { connected: boolean; canSign: boolean };
  balances: { usdc: number; sol: number } | null;
  items: { symbol: string; kind: ItemKind; usdcAmount: number }[];
  quotes: Map<string, ItemQuote>;
  /** Quotes still loading. */
  quoting: boolean;
}): PreflightCheck[] {
  const { wallet, balances, items, quotes } = input;
  const total = items.reduce((sum, item) => sum + item.usdcAmount, 0);
  const small = items.filter((item) => !(item.usdcAmount >= MIN_ORDER_USD));
  const blocked = items.filter((item) =>
    itemWarnings(quotes.get(item.symbol)).some((w) => w.severity === "block"),
  );
  const unquoted = items.filter((item) => !quotes.has(item.symbol));
  const quotesPending = input.quoting || unquoted.length > 0;
  const fees = solNeeded(items, quotes);
  // null: still checking (no balances yet, or quotes still loading).
  const usdcOk = balances && total <= balances.usdc + 1e-9;
  const solOk =
    !balances || quotesPending ? null : fees.unknown.length === 0 && balances.sol >= fees.sol;
  const quotesOk = quotesPending ? null : blocked.length === 0;
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
      ok: usdcOk,
      label: balances
        ? usdcOk
          ? `Enough USDC: ${formatUsd(total)} of ${formatUsd(balances.usdc)}`
          : `Not enough USDC: the plan needs ${formatUsd(total)}, your wallet holds ${formatUsd(balances.usdc)}`
        : "Checking your USDC…",
    },
    {
      id: "sol",
      ok: solOk,
      label:
        solOk === null
          ? "Checking your SOL…"
          : fees.unknown.length > 0
            ? `Jupiter didn't report network fees for ${fees.unknown.join(", ")}, so your SOL can't be checked`
            : solOk
              ? fees.sol === 0
                ? "No SOL needed for fees (gasless)"
                : `Enough SOL for fees: ${fees.sol.toFixed(4)} of ${balances!.sol.toFixed(4)} SOL`
              : `Not enough SOL for fees: ${fees.sol.toFixed(4)} SOL needed, your wallet holds ${balances!.sol.toFixed(4)}`,
    },
    {
      id: "quotes",
      ok: quotesOk,
      label:
        quotesOk === null
          ? "Getting fresh quotes…"
          : quotesOk
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

/** "Can't buy NVDAx right now: <reason>", with one reason when they share it. */
function cantBuy(items: { symbol: string; problem: string | null }[]): string {
  const symbols = items.map((i) => i.symbol).join(", ");
  const reasons = [...new Set(items.map((i) => i.problem).filter(Boolean))];
  return reasons.length === 1
    ? `Can't buy ${symbols} right now: ${reasons[0]}`
    : `Can't buy ${symbols} right now`;
}
