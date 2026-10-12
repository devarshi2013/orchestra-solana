import type { ApiError } from "@/lib/api-client";
import type { ExecuteResponse, OrderResponse } from "@/lib/jupiter/schemas";

/**
 * Maps every way a swap can fail (quote, wallet, execute, our API) onto a small
 * set of kinds the UI knows how to explain, using Jupiter's documented error codes.
 */

type SwapErrorKind =
  | "rejected" // user declined in the wallet
  | "expired" // quote / blockhash expired; safe to re-quote automatically
  | "slippage" // price moved past the slippage tolerance
  | "insufficient_sol" // not enough SOL for network fees / rent
  | "insufficient_balance" // not enough of the input token
  | "below_minimum" // under Jupiter's minimum (gasless ~$10 when SOL < 0.01)
  | "no_route"
  | "rate_limited"
  | "wallet"
  | "network"
  | "unknown";

export type SwapError = {
  kind: SwapErrorKind;
  title: string;
  message: string;
  /** Present when a transaction reached the chain, e.g. a slippage failure. */
  signature?: string;
};

const err = (kind: SwapErrorKind, title: string, message: string): SwapError => ({
  kind,
  title,
  message,
});

const INSUFFICIENT_SOL = err(
  "insufficient_sol",
  "Not enough SOL for fees",
  "Your wallet needs a little SOL to pay network fees and token-account rent. Add SOL and try again.",
);
const INSUFFICIENT_BALANCE = err(
  "insufficient_balance",
  "Insufficient balance",
  "Your wallet doesn't hold enough of the input token for this amount.",
);
const BELOW_MINIMUM = err(
  "below_minimum",
  "Amount below Jupiter's minimum",
  "With under 0.01 SOL in your wallet, Jupiter only covers fees for swaps of roughly $10 or more. Increase the amount or add SOL for fees.",
);
const EXPIRED = err(
  "expired",
  "Quote expired",
  "The quote expired before the transaction was sent. Fetching a fresh quote.",
);
const SLIPPAGE = err(
  "slippage",
  "Price moved too much",
  "The price changed beyond the slippage tolerance before the swap landed, so it was reverted. No tokens were swapped (only the network fee was charged) — get a fresh quote and try again.",
);
const NO_ROUTE = err(
  "no_route",
  "No route found",
  "Jupiter couldn't route this swap. The amount may be too small or the pair too illiquid.",
);

/** `/order` error codes per router (JupiterZ RFQ vs the aggregator routers). */
const JUPITERZ_ORDER_ERRORS: Record<number, SwapError> = {
  1: INSUFFICIENT_BALANCE,
  2: err(
    "unknown",
    "Token account missing",
    "The market maker needs an output token account that doesn't exist yet. Try again in a moment.",
  ),
  3: NO_ROUTE,
};
const ORDER_ERRORS: Record<number, SwapError> = {
  1: INSUFFICIENT_BALANCE,
  2: INSUFFICIENT_SOL,
  3: BELOW_MINIMUM,
};

/** `/order` returned pricing but `transaction: ""`. Codes depend on the router. */
export function classifyOrderError(
  order: Pick<OrderResponse, "router" | "errorCode" | "errorMessage">,
): SwapError {
  const errors = order.router === "jupiterz" ? JUPITERZ_ORDER_ERRORS : ORDER_ERRORS;
  return (
    errors[order.errorCode ?? 0] ??
    err(
      "unknown",
      "Can't build this swap",
      order.errorMessage ?? "Jupiter quoted a price but couldn't build a transaction.",
    )
  );
}

const EXPIRED_CODES = [-1, -1004, -2003];
const NOT_LANDED_CODES = [-1000, -2000];
const NOT_LANDED = err(
  "unknown",
  "Transaction didn't land",
  "The network didn't confirm the transaction in time. No tokens were swapped — try again.",
);
const MARKET_MAKER_REJECTED = err(
  "unknown",
  "Market maker rejected the swap",
  "The RFQ market maker declined this fill. Get a fresh quote and try again.",
);
/** Failure text → error, checked in order. */
const EXECUTE_PATTERNS: [RegExp, SwapError][] = [
  [/slippage|0x1771|custom program error: 6001\b/i, SLIPPAGE],
  [
    /insufficient lamports|InsufficientFundsForFee|insufficient funds for (fee|rent)|InsufficientFundsForRent/i,
    INSUFFICIENT_SOL,
  ],
  [/insufficient funds/i, INSUFFICIENT_BALANCE],
];

/** `/execute` returned `status: "Failed"` (or a 400 with a code). */
export function classifyExecuteResult(
  result: Pick<ExecuteResponse, "code" | "error" | "signature">,
): SwapError {
  if (EXPIRED_CODES.includes(result.code)) return EXPIRED;
  const message = result.error ?? "";
  const matched = EXECUTE_PATTERNS.find(([pattern]) => pattern.test(message))?.[1];
  if (!matched && result.code === -2004) return MARKET_MAKER_REJECTED;
  const error =
    matched ??
    (NOT_LANDED_CODES.includes(result.code)
      ? NOT_LANDED
      : err("unknown", "Swap failed", message || `Jupiter returned error code ${result.code}.`));
  return result.signature ? { ...error, signature: result.signature } : error;
}

/** Errors thrown by our own /api routes (see lib/api-client.ts). */
export function classifyApiError({
  status,
  message,
  code,
  signature,
}: Pick<ApiError, "status" | "message" | "code" | "signature">): SwapError {
  if (status === 0)
    return err("network", "Network error", "Couldn't reach the server. Check your connection.");
  if (status === 429)
    return err(
      "rate_limited",
      "Too many requests",
      "Jupiter's rate limit was hit. Wait a few seconds and try again.",
    );
  if (code !== undefined) return classifyExecuteResult({ code, error: message, signature });
  // Jupiter answers "Failed to get quotes" (400) for dust amounts and unroutable pairs.
  if (/no route|route not found|could not find any route|failed to get quotes/i.test(message))
    return NO_ROUTE;
  if (/amount/i.test(message) && /small|minimum|min/i.test(message)) return BELOW_MINIMUM;
  return err("unknown", "Request failed", message);
}

/** Errors thrown by wallet.signTransaction. */
export function classifyWalletError(error: unknown): SwapError {
  const e = error as { name?: string; message?: string; code?: number; error?: { code?: number } };
  const message = e?.message ?? String(error);
  const code = e?.code ?? e?.error?.code;
  if (code === 4001 || /reject|denied|declin|cancel|closed/i.test(message)) {
    return err("rejected", "Signature rejected", "You declined the transaction in your wallet.");
  }
  if (/read-only|watch-only|cannot sign/i.test(message)) {
    return err(
      "wallet",
      "Watch-only account",
      "The connected account was added by address only, so your wallet can't sign with it. Switch to an account imported with its seed phrase or private key, then reconnect.",
    );
  }
  return err("wallet", "Wallet error", message || "Your wallet couldn't sign the transaction.");
}
