import type { AcceptedPlan } from "@/lib/agent/plan";
import type { TickerSymphony } from "@/lib/symphony/ticker-tree";

/** What the browser sees of plan executions (no unsigned transactions, no mints). */

export type ExecutionStatus = "planned" | "executing" | "completed" | "partial" | "cancelled";
export type ItemStatus = "pending" | "quoted" | "executing" | "succeeded" | "failed" | "skipped";

export type ExecutionItemView = {
  id: string;
  index: number;
  kind: "stock" | "crypto";
  symbol: string;
  name: string;
  decimals: number;
  usdcAmount: number;
  status: ItemStatus;
  signature: string | null;
  /** USDC spent and tokens received, base units. */
  inputAmount: string | null;
  outputAmount: string | null;
  error: string | null;
  outcomeUnknown: boolean;
  executedAt: string | null;
};

export type ExecutionView = {
  id: string;
  conversationId: string | null;
  rankingMethod: string;
  totalUsdc: number;
  status: ExecutionStatus;
  createdAt: string;
  completedAt: string | null;
  items: ExecutionItemView[];
};

export type PreparedItem =
  | { status: "failed"; reason: string; execution: ExecutionView }
  | {
      status: "quoted";
      execution: ExecutionView;
      order: {
        transaction: string;
        requestId: string;
        expireAt: string | null;
        lastValidBlockHeight: string | null;
      };
    };

export type ExecutedItem = {
  /** "requote": expired before landing, nothing traded; prepare again. */
  outcome: "succeeded" | "failed" | "requote" | "unknown";
  message?: string;
  execution: ExecutionView;
};

/** One tool call and its result, as shown in a "data used" panel. */
export type ToolCallView = {
  id: string;
  name: string;
  input: unknown;
  /** The tool result as the model saw it (addresses redacted, long results cut). */
  result: string | null;
  ok: boolean | null;
};

/** A stored conversation, replayed for display. */
export type TranscriptTurn =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      tools: ToolCallView[];
      plan: AcceptedPlan | null;
      /** Symphonies proposed in this answer, keyed by their tool call id. */
      symphonies: (SymphonyProposal & { id: string })[];
    };

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  executions: number;
};

/** The backtester's key results, as tools return them and cards show them. */
export type BacktestSummary = {
  period: "3M" | "6M" | "1Y" | "max";
  /** First and last day of the simulated equity curve. */
  from: string;
  to: string;
  tradingDays: number;
  /** Fractions: 0.12 = 12%. */
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  volatility: number | null;
  sharpe: number | null;
  /** Buy-and-hold SOL over the same days with the same costs (null without SOL prices). */
  solTotalReturn: number | null;
  rebalances: number;
  totalCostUsdc: number;
  settings: { startingCapitalUsdc: number; rebalance: string; feeBps: number; slippageBps: number };
  /** Tokens without stored history for part or all of the period. */
  shortHistory: { ticker: string; firstDate: string | null }[];
};

/** A symphony the assistant proposed (symbols only; the server resolves mints when opened). */
export type SymphonyProposal = {
  tree: TickerSymphony;
  backtest: BacktestSummary | null;
  /** Why there's no backtest, when there isn't one. */
  backtestNote: string | null;
};

export type SymphonyListItem = {
  id: string;
  kind: "draft" | "investment";
  name: string;
  /** Investments only. */
  status: string | null;
  updatedAt: string;
};
