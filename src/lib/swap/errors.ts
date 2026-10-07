import type { ExecuteResponse, OrderResponse } from "@/lib/jupiter/schemas";

/**
 * Maps every way a swap can fail (quote, wallet, execute, our API) onto a small
 * set of kinds the UI knows how to explain. Error codes per docs/jupiter-api.md.
 */

export type SwapErrorKind =
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

const SLIPPAGE_PATTERN = /slippage|0x1771|custom program error: 6001\b/i;
const INSUFFICIENT_SOL_PATTERN =
  /insufficient lamports|InsufficientFundsForFee|insufficient funds for (fee|rent)|InsufficientFundsForRent/i;
const INSUFFICIENT_FUNDS_PATTERN = /insufficient funds/i;

/** `/order` returned pricing but `transaction: ""`. Codes depend on the router. */
export function classifyOrderError(
  order: Pick<OrderResponse, "router" | "errorCode" | "errorMessage">,
): SwapError {
  const fallback = err(
    "unknown",
    "Can't build this swap",
    order.errorMessage ?? "Jupiter quoted a price but couldn't build a transaction.",
  );
  if (order.router === "jupiterz") {
    switch (order.errorCode) {
      case 1:
        return INSUFFICIENT_BALANCE;
      case 2:
        return err(
          "unknown",
          "Token account missing",
          "The market maker needs an output token account that doesn't exist yet. Try again in a moment.",
        );
      case 3:
        return NO_ROUTE;
      default:
        return fallback;
    }
  }
  switch (order.errorCode) {
    case 1:
      return INSUFFICIENT_BALANCE;
    case 2:
      return INSUFFICIENT_SOL;
    case 3:
      return BELOW_MINIMUM;
    default:
      return fallback;
  }
}

/** `/execute` returned `status: "Failed"` (or a 400 with a code). */
export function classifyExecuteResult(
  result: Pick<ExecuteResponse, "code" | "error" | "signature">,
): SwapError {
  const withSignature = (e: SwapError): SwapError =>
    result.signature ? { ...e, signature: result.signature } : e;
  const message = result.error ?? "";

  if (result.code === -1 || result.code === -1004 || result.code === -2003) return EXPIRED;
  if (SLIPPAGE_PATTERN.test(message)) return withSignature(SLIPPAGE);
  if (INSUFFICIENT_SOL_PATTERN.test(message)) return withSignature(INSUFFICIENT_SOL);
  if (INSUFFICIENT_FUNDS_PATTERN.test(message)) return withSignature(INSUFFICIENT_BALANCE);

  switch (result.code) {
    case -2004:
      return err(
        "unknown",
        "Market maker rejected the swap",
        "The RFQ market maker declined this fill. Get a fresh quote and try again.",
      );
    case -1000:
    case -2000:
      return withSignature(
        err(
          "unknown",
          "Transaction didn't land",
          "The network didn't confirm the transaction in time. No tokens were swapped — try again.",
        ),
      );
    default:
      return withSignature(
        err("unknown", "Swap failed", message || `Jupiter returned error code ${result.code}.`),
      );
  }
}

/** Errors thrown by our own /api routes (see lib/api-client.ts). */
export function classifyApiError(error: {
  status: number;
  message: string;
  code?: number;
  signature?: string;
}): SwapError {
  if (error.status === 0) {
    return err("network", "Network error", "Couldn't reach the server. Check your connection.");
  }
  if (error.status === 429) {
    return err(
      "rate_limited",
      "Too many requests",
      "Jupiter's rate limit was hit. Wait a few seconds and try again.",
    );
  }
  if (typeof error.code === "number") {
    return classifyExecuteResult({
      code: error.code,
      error: error.message,
      signature: error.signature,
    });
  }
  // Jupiter answers "Failed to get quotes" (400) for dust amounts and unroutable pairs.
  if (
    /no route|route not found|could not find any route|failed to get quotes/i.test(error.message)
  ) {
    return NO_ROUTE;
  }
  if (/amount/i.test(error.message) && /small|minimum|min/i.test(error.message)) {
    return BELOW_MINIMUM;
  }
  return err("unknown", "Request failed", error.message);
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
