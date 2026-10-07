import type { NextRequest } from "next/server";
import { z } from "zod";

import { getRegistry } from "@/server/assets/registry";
import { upstreamErrorResponse, validationErrorResponse } from "@/server/http";
import { paced } from "@/server/jupiter/pace";
import { getPriceQuotes, type PriceQuote } from "@/server/jupiter/price";

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; prices: Record<string, PriceQuote> }>();

/** GET ?kind=stock|crypto → live price and 24h change for that tab's registry assets. */
export async function GET(request: NextRequest) {
  const kind = z.enum(["stock", "crypto"]).safeParse(request.nextUrl.searchParams.get("kind"));
  if (!kind.success) return validationErrorResponse(kind.error);
  const hit = cache.get(kind.data);
  if (hit && Date.now() - hit.at < CACHE_MS) return Response.json(hit.prices);
  try {
    const registry = await getRegistry();
    const assets = kind.data === "stock" ? registry.stocks : registry.crypto;
    const prices = await paced(() => getPriceQuotes(assets.map((a) => a.mint)));
    cache.set(kind.data, { at: Date.now(), prices });
    return Response.json(prices);
  } catch (error) {
    return upstreamErrorResponse(error);
  }
}
