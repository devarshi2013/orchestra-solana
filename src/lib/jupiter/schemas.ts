import { z } from "zod";

/**
 * Shapes of Jupiter responses as Askfirst uses them (see docs/jupiter-api.md).
 * Unknown keys are stripped, so these double as the trimmed payloads our /api
 * routes return to the browser. Client-safe: no server imports.
 */

export const base58AddressSchema = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "Invalid Solana address");

const stringish = z.union([z.string(), z.number()]).transform(String);

export const routePlanStepSchema = z.object({
  swapInfo: z.object({
    label: z.string().nullish(),
    inputMint: z.string(),
    outputMint: z.string(),
  }),
  percent: z.number().nullish(),
  bps: z.number().nullish(),
});

export const orderResponseSchema = z.object({
  requestId: z.string(),
  /** base64 tx; null without taker; "" when quoted but not buildable (see errorCode). */
  transaction: z.string().nullable(),
  inputMint: z.string(),
  outputMint: z.string(),
  inAmount: z.string(),
  outAmount: z.string(),
  otherAmountThreshold: z.string().nullish(),
  slippageBps: z.number().nullish(),
  /** Percentage points: -0.1 means -0.1%. */
  priceImpact: z.number().nullish(),
  inUsdValue: z.number().nullish(),
  outUsdValue: z.number().nullish(),
  router: z.string(),
  mode: z.string().nullish(),
  feeBps: z.number().nullish(),
  feeMint: z.string().nullish(),
  routePlan: z.array(routePlanStepSchema).nullish(),
  gasless: z.boolean().nullish(),
  /** Network costs the taker pays (lamports); absent without a taker. */
  signatureFeeLamports: z.number().nullish(),
  prioritizationFeeLamports: z.number().nullish(),
  rentFeeLamports: z.number().nullish(),
  /** Jupiter's platform fee, charged in feeMint. */
  platformFee: z
    .object({
      amount: stringish.nullish(),
      feeBps: z.number().nullish(),
      feeMint: z.string().nullish(),
    })
    .nullish(),
  lastValidBlockHeight: stringish.nullish(),
  /** RFQ (JupiterZ) quote expiry. */
  expireAt: stringish.nullish(),
  errorCode: z.number().nullish(),
  errorMessage: z.string().nullish(),
});

export type OrderResponse = z.infer<typeof orderResponseSchema>;
export type RoutePlanStep = z.infer<typeof routePlanStepSchema>;

export const executeResponseSchema = z.object({
  status: z.enum(["Success", "Failed"]),
  code: z.number(),
  signature: z.string().nullish(),
  slot: stringish.nullish(),
  error: z.string().nullish(),
  totalInputAmount: z.string().nullish(),
  totalOutputAmount: z.string().nullish(),
  inputAmountResult: z.string().nullish(),
  outputAmountResult: z.string().nullish(),
});

export type ExecuteResponse = z.infer<typeof executeResponseSchema>;

export const mintInformationSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  icon: z.string().nullish(),
  decimals: z.number().int().nonnegative(),
  isVerified: z.boolean().nullish(),
  tags: z.array(z.string()).nullish(),
  organicScore: z.number().nullish(),
  /** USD liquidity across the token's pools. */
  liquidity: z.number().nullish(),
  audit: z.object({ isSus: z.boolean().nullish() }).nullish(),
});

export type MintInformation = z.infer<typeof mintInformationSchema>;
