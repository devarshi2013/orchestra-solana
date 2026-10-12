import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import { MIN_ORDER_USD } from "@/lib/units";

/**
 * Strategies: "buy $190 of NVDAx when its price drops below $220". The server
 * checks every watching strategy each minute against Jupiter's live price;
 * when one triggers, the user is notified (in the app, and on their webhook if
 * set) and buys with one tap, signing in their own wallet.
 */

/** What makes a strategy trigger. Prices are the token's USD price on Jupiter. */
export const conditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("price_below"), price: z.number().positive() }),
  z.object({ type: z.literal("price_above"), price: z.number().positive() }),
  /** 24h change at or below `pct` (e.g. -5 = down 5% or more). */
  z.object({ type: z.literal("change_below"), pct: z.number().min(-100).max(0) }),
  /** 24h change at or above `pct`. */
  z.object({ type: z.literal("change_above"), pct: z.number().min(0).max(1000) }),
  /** Every `days` days from creation (a recurring buy reminder). */
  z.object({ type: z.literal("every"), days: z.number().int().min(1).max(365) }),
]);
export type Condition = z.infer<typeof conditionSchema>;

/** POST /api/strategies body: a token by symbol (resolved to its mint on the server). */
export const newStrategySchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  usdcAmount: z.number().finite().min(MIN_ORDER_USD).max(1_000_000),
  condition: conditionSchema,
  /** Watch again after it's bought (e.g. buy every dip), instead of finishing. */
  repeat: z.boolean().default(false),
});
export type NewStrategy = z.input<typeof newStrategySchema>;

export type StrategyStatus = "watching" | "triggered" | "filled" | "cancelled";

export type Strategy = {
  id: string;
  wallet: string;
  /** The token bought (from the live stock universe, never from input text). */
  mint: string;
  symbol: string;
  ticker: string;
  name: string;
  usdcAmount: number;
  condition: Condition;
  repeat: boolean;
  status: StrategyStatus;
  createdAt: string;
  /** When it last triggered, and the price or 24h change that triggered it. */
  triggeredAt: string | null;
  triggerValue: number | null;
  /** The last buy that filled it. */
  lastFillSignature: string | null;
};

/** A buy made through the app, checked on-chain before it's recorded. */
export type Fill = {
  signature: string;
  wallet: string;
  strategyId: string | null;
  mint: string;
  symbol: string;
  side: "buy" | "sell";
  usdcAmount: number;
  tokenAmount: number;
  /** USDC per token. */
  price: number;
  blockTime: string;
};

export type Notification = {
  id: string;
  strategyId: string | null;
  kind: "triggered" | "filled";
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

/** POST /api/fills body: the signature of a swap the user just landed. */
export const newFillSchema = z.object({
  signature: z.string().min(64).max(100),
  strategyId: z.string().uuid().nullish(),
});

export const webhookSchema = z.object({ webhookUrl: z.url().max(500).nullable() });

/** One position: the wallet's balance of a listed stock token, with cost basis from fills. */
export type Position = {
  mint: string;
  symbol: string;
  ticker: string;
  name: string;
  icon: string | null;
  tokenAmount: number;
  /** Average USDC per token over recorded buys (null with no recorded buys). */
  avgCost: number | null;
  /** How much of `tokenAmount` recorded buys account for (tokens bought elsewhere have no known cost). */
  recordedAmount: number;
  /** USDC spent on `recordedAmount`, at average cost (null with no recorded buys). */
  costBasis: number | null;
};

/** GET /api/profile → everything the profile page shows (prices come live from /api/prices). */
export type ProfileResponse = {
  wallet: string;
  webhookUrl: string | null;
  positions: Position[];
  strategies: Strategy[];
  fills: Fill[];
  notifications: Notification[];
  usdcBalance: number;
};

export const HISTORY_PERIODS = ["7d", "30d", "90d", "1y"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number];

/** One day of the portfolio. */
export type PortfolioPoint = {
  /** The UTC day, as unix seconds at 00:00. */
  time: number;
  /**
   * "snapshot" / "live": every listed stock token held plus USDC, at that day's
   * (or the live) price. "backfill": only holdings bought through Tickertape, at
   * that day's close, before snapshots began (USDC then is unknown).
   */
  value: number;
  /** Unrealized P&L of the holdings bought through Tickertape: their value minus their cost. */
  pnl: number;
  source: "backfill" | "snapshot" | "live";
};

/** GET /api/portfolio/history?period= → one point per day, oldest first, today live. */
export type PortfolioHistoryResponse = { points: PortfolioPoint[]; backfilled: boolean };

/** GET /api/prices?mints= → Jupiter's live USD price and 24h change per mint (null when Jupiter has none). */
export type PricesResponse = {
  prices: Record<string, { price: number; change24h: number | null } | null>;
  asOf: string;
};

/** Sign-in: GET /api/auth/nonce → { nonce, message } to sign; POST /api/auth/verify { wallet, signature (base58), message }. */
export const verifySchema = z.object({
  wallet: base58AddressSchema,
  signature: z.string().min(64).max(120),
  message: z.string().min(1).max(1000),
});

/** GET /api/auth/me → the signed-in wallet, or null. */
export type MeResponse = { wallet: string | null };
