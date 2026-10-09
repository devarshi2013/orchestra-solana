import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";

/** POST /api/assistant/quote: one plan item, quoted for the connected wallet. */
export const quoteRequestSchema = z.object({
  wallet: base58AddressSchema,
  symbol: z.string().trim().min(1).max(20),
  usdcAmount: z.number().finite().positive().max(1_000_000),
});
