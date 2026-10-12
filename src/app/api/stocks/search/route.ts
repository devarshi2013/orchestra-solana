import type { NextRequest } from "next/server";
import { z } from "zod";

import type { StockSearchResponse } from "@/lib/stocks/api";
import { jsonOr502, validationErrorResponse } from "@/server/http";
import { searchStocks } from "@/server/stocks/universe";

const querySchema = z.object({ q: z.string().trim().min(1).max(64) });

/** GET ?q=micron → Jupiter's token search, kept to listed stock tokens, as companies. */
export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get("q") });
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { q } = parsed.data;
  return jsonOr502(
    `[stocks] search failed "${q}"`,
    async () => ({ stocks: await searchStocks(q) }) satisfies StockSearchResponse,
    "public, s-maxage=30",
  );
}
