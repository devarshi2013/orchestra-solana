import { z } from "zod";

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
