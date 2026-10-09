import { listStocks, REGISTRY } from "@/lib/stocks/registry";
import { ISSUER_NAMES, SECTORS } from "@/lib/stocks/types";

/**
 * GET → every company in the stock registry (each with its issuers' tokens and
 * liquidity tiers), most liquid first, for the "Browse stocks" panel. Static: the registry only
 * changes when it's re-synced and redeployed. No mints.
 */
export function GET() {
  const list = listStocks();
  const present = new Set(list.map((c) => c.sector));
  return Response.json({
    syncedAt: REGISTRY.syncedAt,
    sectors: SECTORS.filter((s) => present.has(s)),
    companies: list.map((c) => ({
      ...c,
      issuers: c.issuers.map((i) => ({
        issuer: ISSUER_NAMES[i.issuer],
        symbol: i.symbol,
        liquidityTier: i.liquidityTier,
      })),
    })),
  });
}
