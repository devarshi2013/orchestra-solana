import { z } from "zod";

import { rebalanceRuleSchema } from "@/lib/backtest/types";
import { symphonySchema } from "@/lib/symphony/schema";

const email = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.email().nullable());

/** POST /api/investments */
export const createInvestmentSchema = z.object({
  symphony: symphonySchema,
  sourceDraftId: z.uuid().optional(),
  rebalance: rebalanceRuleSchema,
  /** Legs within this many percentage points of target are skipped. */
  driftThresholdPct: z.number().finite().min(0).max(50),
  notifyEmail: email.optional(),
});
export type CreateInvestment = z.infer<typeof createInvestmentSchema>;

/** PATCH /api/investments/[id] */
export const updateInvestmentSchema = z.object({
  status: z.enum(["active", "paused", "closed"]).optional(),
  rebalance: rebalanceRuleSchema.optional(),
  driftThresholdPct: z.number().finite().min(0).max(50).optional(),
  notifyEmail: email.optional(),
});

/** POST /api/runs/[id]/legs/[index] */
export const legActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare") }),
  z.object({
    action: z.literal("execute"),
    signedTransaction: z
      .string()
      .min(1)
      .max(4096)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, "signedTransaction must be base64"),
  }),
  z.object({ action: z.literal("abandon"), reason: z.string().trim().min(1).max(300) }),
]);
