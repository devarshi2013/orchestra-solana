import { connection } from "next/server";

import { friendlyError } from "@/lib/friendly-error";
import type { NetworkStats } from "@/lib/markets/types";
import { cached } from "@/server/cache";
import { errorResponse } from "@/server/http";
import { getRecentTps } from "@/server/solana/rpc";

const TTL_MS = 30_000;

/** GET → Solana's recent transactions per second from our RPC (getRecentPerformanceSamples), cached 30 s. */
export async function GET() {
  await connection();
  try {
    const stats = await cached("network:tps", TTL_MS, async (): Promise<NetworkStats> => {
      const tps = (await getRecentTps()).map((n) => Math.round(n));
      if (tps.length === 0) throw new Error("No performance samples");
      return { tps, latest: tps.at(-1)!, asOf: new Date().toISOString() };
    });
    return Response.json(stats, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[network] tps failed", error);
    return errorResponse(502, friendlyError(error));
  }
}
