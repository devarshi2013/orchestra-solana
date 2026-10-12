import type { NextRequest } from "next/server";
import { z } from "zod";

import { base58AddressSchema } from "@/lib/jupiter/schemas";
import type { PricesResponse } from "@/lib/strategies/types";
import { cached } from "@/server/cache";
import { jsonOr502, validationErrorResponse } from "@/server/http";
import { livePrices } from "@/server/prices";

const mintsSchema = z.array(base58AddressSchema).min(1).max(50);

/** GET ?mints=a,b → Jupiter's live USD price and 24h change per mint (cached 5 s). */
export async function GET(request: NextRequest) {
  const parsed = mintsSchema.safeParse(
    request.nextUrl.searchParams.get("mints")?.split(",").filter(Boolean),
  );
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const mints = [...new Set(parsed.data)].sort();
  // One Jupiter read per set of mints every 5 s, however many viewers ask.
  return jsonOr502(
    "[prices] failed",
    () =>
      cached(`prices:${mints.join(",")}`, 5_000, async (): Promise<PricesResponse> => ({
        prices: await livePrices(mints),
        asOf: new Date().toISOString(),
      })),
    "public, s-maxage=5",
  );
}
