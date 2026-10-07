import { z } from "zod";

import type { EvaluationWarning } from "@/lib/symphony/evaluate";
import type { Allocation } from "@/lib/symphony/types";

/**
 * When the portfolio trades back to the symphony's target:
 * - daily: every day;
 * - weekly: the first trading day of each ISO week (Monday, UTC);
 * - monthly: the first trading day of each calendar month (UTC);
 * - threshold: any day a holding drifts more than `driftPct` percentage points
 *   from the target, which is re-evaluated daily (so a changed signal counts).
 * Every rule also trades on the first day, from all-cash.
 */
export type RebalanceRule =
  | { kind: "daily" }
  | { kind: "weekly" }
  | { kind: "monthly" }
  | { kind: "threshold"; driftPct: number };

export const rebalanceRuleSchema: z.ZodType<RebalanceRule> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("daily") }),
  z.object({ kind: z.literal("weekly") }),
  z.object({ kind: z.literal("monthly") }),
  z.object({ kind: z.literal("threshold"), driftPct: z.number().finite().positive().max(100) }),
]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const bps = z.number().finite().min(0).max(10_000);

export const backtestConfigSchema = z
  .object({
    /** First day whose close is in the equity curve; it trades on the prior day's close. */
    startDate: isoDate,
    endDate: isoDate,
    rebalance: rebalanceRuleSchema,
    startingCapitalUsdc: z.number().finite().positive(),
    /** Swap fee per trade, on the traded notional. */
    feeBps: bps,
    /** Price moves this much against each fill. */
    slippageBps: bps,
  })
  .refine((c) => c.startDate <= c.endDate, {
    message: "startDate is after endDate",
    path: ["endDate"],
  });

export type BacktestConfig = z.infer<typeof backtestConfigSchema>;

export type Trade = {
  mint: string;
  side: "buy" | "sell";
  units: number;
  /** Fill price after slippage. */
  price: number;
  /** USDC paid (buy) or received (sell), after fees. */
  usdc: number;
  /** Fees + slippage in USDC, versus trading the same units at the close. */
  cost: number;
};

export type RebalanceRecord = {
  /** Trading day; fills at the previous day's close. */
  date: string;
  /** Last close the decision could see (the day before `date`). */
  decidedOn: string;
  /** What the symphony asked for, cash (USDC) included. */
  target: Allocation;
  /** Weights right after trading, valued at the fill prices. */
  weightsAfter: Allocation;
  trades: Trade[];
  cost: number;
  warnings: EvaluationWarning[];
  /** Target mints with no price yet; their weight stayed in cash. */
  unpriced: string[];
};

export type EquityPoint = { date: string; value: number; benchmark: number | null };

export type Metrics = {
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  /** Annualized (√365) stdev of daily returns. */
  volatility: number | null;
  sharpe: number | null;
  sortino: number | null;
  /** Share of days with a positive return. */
  winRate: number | null;
};

export type BacktestResult = {
  /** Starts with the pre-trade capital on the day before `startDate`. */
  equity: EquityPoint[];
  metrics: Metrics;
  /** Buy-and-hold SOL with the same capital and costs; null without SOL prices. */
  benchmark: Metrics | null;
  rebalances: RebalanceRecord[];
  totalCost: number;
};
