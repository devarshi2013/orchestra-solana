import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";

const U64_MAX = 18_446_744_073_709_551_615n;

/** Query for GET /api/swap/order. */
export const orderQuerySchema = z
  .object({
    inputMint: base58AddressSchema,
    outputMint: base58AddressSchema,
    amount: z
      .string()
      .regex(/^[1-9]\d{0,19}$/, {
        message: "amount must be a positive integer in base units",
        abort: true, // don't run the BigInt refinement on non-numeric input
      })
      .refine((v) => BigInt(v) <= U64_MAX, "amount exceeds u64"),
    taker: base58AddressSchema.optional(),
  })
  .refine((q) => q.inputMint !== q.outputMint, { message: "Input and output tokens must differ" });

export type OrderQuery = z.infer<typeof orderQuerySchema>;

/** Body for POST /api/swap/execute. */
export const executeBodySchema = z.object({
  // A Solana transaction is at most 1232 bytes, so base64 stays well under 2 KB.
  signedTransaction: z
    .string()
    .min(1)
    .max(4096)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "signedTransaction must be base64"),
  requestId: z.string().min(1).max(256),
});

export type ExecuteBody = z.infer<typeof executeBodySchema>;
