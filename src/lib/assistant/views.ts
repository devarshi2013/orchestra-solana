import type Anthropic from "@anthropic-ai/sdk";

import type { AcceptedPlan } from "@/lib/agent/plan";
import type { Condition } from "@/lib/strategies/types";

/** One tool call and its result, as shown in a "data used" panel. */
export type ToolCallView = {
  id: string;
  name: string;
  input: unknown;
  /** The tool result as the model saw it (addresses redacted, long results cut). */
  result: string | null;
  ok: boolean | null;
};

/**
 * A conditional buy the assistant proposes (propose_strategy), resolved on the
 * server to a listed token. Nothing is created until the user confirms it.
 */
export type StrategyProposal = {
  symbol: string;
  ticker: string;
  name: string;
  mint: string;
  usdcAmount: number;
  condition: Condition;
  repeat: boolean;
  /** The token's USD price when proposed (null when Jupiter had none). */
  currentPrice: number | null;
};

/** What one assistant turn reports as it runs (server/agent/loop.ts). */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "progress"; text: string }
  | { type: "tool"; id: string; name: string; input: unknown }
  /** `content`: the result as the model saw it, for the "data used" panel (redacted, capped). */
  | { type: "tool_result"; id: string; name: string; ok: boolean; content: string }
  | { type: "plan"; plan: AcceptedPlan }
  | { type: "strategy"; strategy: StrategyProposal }
  | { type: "error"; message: string };

/** The Server-Sent Events of POST /api/agent: the turn's events, the updated history, then `done`. */
export type StreamEvent =
  | AgentEvent
  | { type: "history"; messages: Anthropic.Beta.Messages.BetaMessageParam[] }
  | { type: "done" };
