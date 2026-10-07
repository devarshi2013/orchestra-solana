import { z } from "zod";

import { rebalanceRuleSchema } from "@/lib/backtest/types";
import { symphonySchema } from "@/lib/symphony/schema";
import { tickerSymphonySchema } from "@/lib/symphony/ticker-tree";

/** POST /api/assistant/quote: one plan item, quoted for the signed-in wallet. */
export const quoteRequestSchema = z.object({
  symbol: z.string().trim().min(1).max(20),
  usdcAmount: z.number().finite().positive().max(1_000_000),
});

/** POST /api/assistant/executions: the (possibly edited) plan the user approved. */
export const createExecutionSchema = z.object({
  conversationId: z.uuid().optional(),
  rankingMethod: z.string().trim().min(1).max(500),
  items: z
    .array(
      z.object({
        kind: z.enum(["stock", "crypto"]),
        symbol: z.string().trim().min(1).max(20),
        usdcAmount: z.number().finite().positive(),
        reason: z.string().trim().min(1).max(500),
      }),
    )
    .min(1)
    .max(20),
});
export type CreateExecution = z.infer<typeof createExecutionSchema>;

/** POST /api/assistant/executions/[id]/items/[index]: one step of buying an item. */
export const itemActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare") }),
  z.object({
    action: z.literal("execute"),
    signedTransaction: z
      .string()
      .min(1)
      .max(4096)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  }),
  z.object({ action: z.literal("abandon"), reason: z.string().trim().min(1).max(300) }),
]);

/** What an "Ask AI" panel sends along with a message. */
export const agentContextSchema = z.discriminatedUnion("kind", [
  /** The editor's current (unsaved or draft) symphony. */
  z.object({ kind: z.literal("editor"), symphony: symphonySchema }),
  /** One of the wallet's live investments. */
  z.object({ kind: z.literal("investment"), investmentId: z.uuid() }),
]);
export type AgentContext = z.infer<typeof agentContextSchema>;

/** POST /api/assistant/symphonies (open a proposal in the editor) and …/resolve (for a diff). */
export const proposalRequestSchema = z.object({ tree: tickerSymphonySchema });

/** POST /api/assistant/executions/[id]/keep-balanced */
export const keepBalancedSchema = z.object({
  name: z.string().trim().min(1).max(80),
  rebalance: rebalanceRuleSchema,
  driftThresholdPct: z.number().finite().min(0).max(50),
});
