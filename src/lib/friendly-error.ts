/**
 * Turns any quote or swap error into one short, plain sentence for people.
 * Raw API messages, request IDs, JSON and error codes never reach the UI: log
 * the original (server or dev console) and show `friendlyError(error)`.
 *
 * Works in the browser and on the server, so it only duck-types errors
 * (our ApiError, Jupiter's JupiterApiError, wallet errors, fetch failures,
 * SwapError kinds from lib/swap/errors.ts, or a plain reason string).
 */

export type FriendlyKind =
  | "rate_limited"
  | "no_route"
  | "network"
  | "insufficient_usdc"
  | "insufficient_sol"
  | "rejected"
  | "unknown";

export const FRIENDLY_MESSAGES: Record<FriendlyKind, string> = {
  rate_limited: "Prices are busy right now. Retrying in a moment…",
  no_route: "This stock can't be traded right now. Try a smaller amount or try again later.",
  network: "Connection issue. Check your internet and try again.",
  insufficient_usdc: "Not enough USDC for this trade.",
  insufficient_sol: "Not enough SOL for network fees.",
  rejected: "Transaction cancelled in your wallet.",
  unknown: "Something went wrong. Please try again.",
};

/** SwapError kinds (lib/swap/errors.ts) → the friendly kind. */
const SWAP_KINDS: Record<string, FriendlyKind> = {
  rejected: "rejected",
  insufficient_balance: "insufficient_usdc",
  insufficient_sol: "insufficient_sol",
  no_route: "no_route",
  below_minimum: "no_route",
  rate_limited: "rate_limited",
  network: "network",
};

const RATE_LIMIT = /too many requests|rate.?limit|\b429\b/i;
const NO_ROUTE =
  /no route|route not found|could not find any route|failed to get quotes|no quote|quote not available|not available|not tradable|cannot be traded|can't be traded|no liquidity|couldn't price|market hours|market maker|minimum trade size/i;
const INSUFFICIENT_SOL =
  /insufficient lamports|InsufficientFundsForFee|InsufficientFundsForRent|insufficient funds for (fee|rent)|not enough sol/i;
const INSUFFICIENT_USDC = /insufficient (funds|balance)|not enough usdc|less than the .* usdc/i;
const NETWORK =
  /network ?error|failed to fetch|fetch failed|load failed|timed? ?out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|connection/i;
const WALLET_REJECT =
  /user rejected|rejected the request|request rejected|denied|declined|cancell?ed/i;

/** Which friendly message fits `error`. */
export function friendlyKind(error: unknown): FriendlyKind {
  if (error === null || error === undefined) return "unknown";
  if (typeof error === "string") return kindFromText(error);

  const e = error as {
    kind?: unknown;
    name?: unknown;
    status?: unknown;
    code?: unknown;
    message?: unknown;
    body?: unknown;
    error?: { code?: unknown };
  };

  // Already classified (SwapError, or { kind } from a quote). An "unknown" one
  // still gets its text checked below.
  if (typeof e.kind === "string" && e.kind !== "unknown") {
    if (e.kind in FRIENDLY_MESSAGES) return e.kind as FriendlyKind;
    if (e.kind in SWAP_KINDS) return SWAP_KINDS[e.kind]!;
  }

  const name = typeof e.name === "string" ? e.name : "";
  const text = [e.message, e.body].filter((v) => typeof v === "string").join(" ");

  // Wallets: EIP-1193 style 4001, or a WalletSign…Error saying the user declined.
  const code = typeof e.code === "number" ? e.code : e.error?.code;
  if (code === 4001 || (/^Wallet/.test(name) && WALLET_REJECT.test(text))) return "rejected";

  if (name === "TimeoutError") return "network";
  if (e.status === 429) return "rate_limited";
  if (e.status === 0) return "network";
  if (name === "TypeError" && NETWORK.test(text)) return "network";
  return kindFromText(text);
}

function kindFromText(text: string): FriendlyKind {
  // Already one of ours (e.g. a reason the server sent): keep it.
  for (const [kind, message] of Object.entries(FRIENDLY_MESSAGES)) {
    if (text.trim() === message) return kind as FriendlyKind;
  }
  if (RATE_LIMIT.test(text)) return "rate_limited";
  if (INSUFFICIENT_SOL.test(text)) return "insufficient_sol";
  if (INSUFFICIENT_USDC.test(text)) return "insufficient_usdc";
  if (NO_ROUTE.test(text)) return "no_route";
  if (NETWORK.test(text)) return "network";
  return "unknown";
}

/** One short, plain sentence for `error`. Never includes the error's own text. */
export function friendlyError(error: unknown): string {
  return FRIENDLY_MESSAGES[friendlyKind(error)];
}

/**
 * When several attempts failed (e.g. each issuer's token for one stock), the
 * one reason to show: the most actionable kind wins.
 */
export function combineKinds(kinds: readonly FriendlyKind[]): FriendlyKind {
  const order: FriendlyKind[] = [
    "rejected",
    "insufficient_usdc",
    "insufficient_sol",
    "rate_limited",
    "network",
    "no_route",
    "unknown",
  ];
  for (const kind of order) if (kinds.includes(kind)) return kind;
  return "unknown";
}

/** Backoff before retry `attempt` (1-based) after a rate limit: 1 s, 2 s, 4 s. */
export const retryDelayMs = (attempt: number) => 1000 * 2 ** (attempt - 1);
export const MAX_RATE_LIMIT_RETRIES = 3;
