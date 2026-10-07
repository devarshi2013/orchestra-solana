import type { RebalanceRule } from "@/lib/backtest/types";
import type { EvaluationWarning } from "@/lib/symphony/evaluate";
import type { Allocation, Symphony } from "@/lib/symphony/types";

import type { Balance, RebalancePlan } from "./plan";
import type { LegStatus, RunStatus } from "./run-state";

/** JSON shapes the /api/investments and /api/runs routes return. */

export type InvestmentView = {
  id: string;
  owner: string;
  name: string;
  symphony: Symphony;
  rebalance: RebalanceRule;
  driftThresholdPct: number;
  status: "active" | "paused" | "closed";
  notifyEmail: string | null;
  holdings: Record<string, number> | null;
  holdingsAt: string | null;
  nextDueAt: string | null;
  lastRebalancedAt: string | null;
  createdAt: string;
};

export type LegQuote = {
  inAmount: string;
  outAmount: string;
  priceImpact: number | null;
  feeBps: number | null;
  router: string;
  decimals: number;
};

export type LegView = {
  id: string;
  index: number;
  side: "sell" | "buy";
  mint: string;
  inputMint: string;
  outputMint: string;
  plannedUsd: number;
  plannedAmount: string;
  full: boolean;
  status: LegStatus;
  amount: string | null;
  quote: LegQuote | null;
  signature: string | null;
  inputAmount: string | null;
  outputAmount: string | null;
  realizedPrice: number | null;
  error: string | null;
  outcomeUnknown: boolean;
  executedAt: string | null;
};

export type SnapshotView = {
  balances: Record<string, Balance>;
  prices: Record<string, number>;
  target: Allocation;
  warnings: EvaluationWarning[];
  asOf: string | null;
  plan: RebalancePlan;
  maxDriftPct?: number;
};

export type RunView = {
  id: string;
  investmentId: string;
  status: RunStatus;
  plan: SnapshotView;
  createdAt: string;
  completedAt: string | null;
  legs: LegView[];
};

export type IndicativeQuote = ({ index: number } & LegQuote) | { index: number; error: string };
