import type { SwapError } from "@/lib/swap/errors";

/**
 * Turns any quote or swap error into one short, plain sentence for people.
 * Raw API messages, request IDs, JSON and error codes never reach the UI: log
 * the original (server or dev console) and show `friendlyError(error)`.
 *
 * Works in the browser and on the server, so it only duck-types errors
 * (our ApiError, Jupiter's JupiterApiError, wallet errors, fetch failures,
 * SwapError kinds from lib/swap/errors.ts, or a plain reason string).
 */

/** Most actionable first: `combineKinds` picks the earliest kind present. */
export const FRIENDLY_MESSAGES = {
  rejected: "Transaction cancelled in your wallet.",
  insufficient_usdc: "Not enough USDC for this trade.",
  insufficient_sol: "Not enough SOL for network fees.",
  rate_limited: "Prices are busy right now. Try again in a moment.",
  network: "Connection issue. Check your internet and try again.",
  no_route: "This stock can't be traded right now. Try a smaller amount or try again later.",
  unknown: "Something went wrong. Please try again.",
};

export type FriendlyKind = keyof typeof FRIENDLY_MESSAGES;
const KINDS = Object.keys(FRIENDLY_MESSAGES) as FriendlyKind[];

/** SwapError kinds (lib/swap/errors.ts) → the friendly kind. */
const SWAP_KINDS: Partial<Record<SwapError["kind"], FriendlyKind>> = {
  rejected: "rejected",
  insufficient_balance: "insufficient_usdc",
  insufficient_sol: "insufficient_sol",
  no_route: "no_route",
  below_minimum: "no_route",
  rate_limited: "rate_limited",
  network: "network",
};

const NETWORK =
  /network ?error|failed to fetch|fetch failed|load failed|timed? ?out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|connection/i;
const WALLET_REJECT =
  /user rejected|rejected the request|request rejected|denied|declined|cancell?ed/i;
/** Error text → kind, checked in order. */
const TEXT_KINDS: [RegExp, FriendlyKind][] = [
  [/too many requests|rate.?limit|\b429\b/i, "rate_limited"],
  [
    /insufficient lamports|InsufficientFundsForFee|InsufficientFundsForRent|insufficient funds for (fee|rent)|not enough sol/i,
    "insufficient_sol",
  ],
  [/insufficient (funds|balance)|not enough usdc|less than the .* usdc/i, "insufficient_usdc"],
  [
    /no route|route not found|could not find any route|failed to get quotes|no quote|quote not available|not available|not tradable|cannot be traded|can't be traded|no liquidity|couldn't price|market hours|market maker|minimum trade size/i,
    "no_route",
  ],
  [NETWORK, "network"],
];

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
    if (e.kind in SWAP_KINDS) return SWAP_KINDS[e.kind as SwapError["kind"]]!;
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
  return (
    // Already one of ours (e.g. a reason the server sent): keep it.
    KINDS.find((kind) => FRIENDLY_MESSAGES[kind] === text.trim()) ??
    TEXT_KINDS.find(([pattern]) => pattern.test(text))?.[1] ??
    "unknown"
  );
}

/** One short, plain sentence for `error`. Never includes the error's own text. */
export function friendlyError(error: unknown): string {
  return FRIENDLY_MESSAGES[friendlyKind(error)];
}
