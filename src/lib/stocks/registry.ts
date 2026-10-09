import generated from "./registry.generated.json";
import {
  LIQUIDITY_TIERS,
  SECTORS,
  type LiquidityTier,
  type RegistryFile,
  type Sector,
  type StockEntry,
} from "./types";

/**
 * The stock registry at runtime: the output of `pnpm sync:stocks`, read-only.
 * It's the only source of mint addresses in Askfirst; nothing (least of all
 * a model) can add one.
 */
export const REGISTRY = generated as RegistryFile;
export const STOCKS: readonly StockEntry[] = REGISTRY.stocks;

/** One company (or fund) with every issuer's token for it. */
export type Company = {
  ticker: string;
  companyName: string;
  type: "stock" | "etf";
  sector: Sector;
  industry: string | null;
  preIpo: boolean;
  /** The most liquid issuer's tier. */
  liquidityTier: LiquidityTier;
  issuers: Pick<StockEntry, "issuer" | "symbol" | "liquidityTier" | "hours">[];
};

const tierRank = (tier: LiquidityTier) => LIQUIDITY_TIERS.indexOf(tier);
const norm = (s: string) => s.trim().replace(/^\$/, "").toUpperCase();

export function companies(stocks: readonly StockEntry[] = STOCKS): Company[] {
  const byTicker = new Map<string, Company>();
  for (const s of stocks) {
    const issuer = {
      issuer: s.issuer,
      symbol: s.symbol,
      liquidityTier: s.liquidityTier,
      hours: s.hours,
    };
    const existing = byTicker.get(s.ticker);
    if (!existing) {
      byTicker.set(s.ticker, {
        ticker: s.ticker,
        companyName: s.companyName,
        type: s.type,
        sector: s.sector,
        industry: s.industry,
        preIpo: s.preIpo,
        liquidityTier: s.liquidityTier,
        issuers: [issuer],
      });
      continue;
    }
    existing.issuers.push(issuer);
    if (tierRank(s.liquidityTier) < tierRank(existing.liquidityTier)) {
      existing.liquidityTier = s.liquidityTier;
    }
    // Prefer a classified sector from any issuer's entry.
    if (existing.sector === "Unclassified" && s.sector !== "Unclassified") {
      existing.sector = s.sector;
      existing.industry = s.industry;
    }
  }
  for (const c of byTicker.values()) {
    c.issuers.sort((a, b) => tierRank(a.liquidityTier) - tierRank(b.liquidityTier));
  }
  return [...byTicker.values()];
}

/** Everyday words for sectors ("tech", "banks", "healthcare") → the standard sector. */
const SECTOR_ALIASES: [RegExp, Sector][] = [
  [/^(tech|it|information technology|software|semis?|semiconductors?|ai)$/i, "Technology"],
  [/^(communications?|telecom(munications)?|media|internet)$/i, "Communication Services"],
  [/^(consumer cyclical|discretionary|retail|autos?)$/i, "Consumer Discretionary"],
  [/^(consumer defensive|staples)$/i, "Consumer Staples"],
  [/^(financial( services)?|finance|banks?|banking|insurance|fintech)$/i, "Financials"],
  [/^(healthcare|health|biotech|pharma(ceuticals)?|medical)$/i, "Health Care"],
  [/^(industrial|aerospace|defen[cs]e)$/i, "Industrials"],
  [/^(oil|gas|oil and gas)$/i, "Energy"],
  [/^(basic materials|metals|mining)$/i, "Materials"],
  [/^(utility)$/i, "Utilities"],
  [/^(reits?|property)$/i, "Real Estate"],
  [/^(broad market|index|multi-sector)$/i, "Diversified"],
];

/** A sector name or common alias → the standard sector, or null if it isn't one. */
export function normalizeSector(input: string): Sector | null {
  const text = input.trim();
  const exact = SECTORS.find((s) => s.toLowerCase() === text.toLowerCase());
  return exact ?? SECTOR_ALIASES.find(([re]) => re.test(text))?.[1] ?? null;
}

export type StockFilter = {
  sector?: string;
  industry?: string;
  type?: "stock" | "etf";
  search?: string;
  /** The least liquid tier to include ("medium" → high and medium). */
  minLiquidity?: LiquidityTier;
};

/** Companies matching every filter, most liquid first, then by ticker. */
export function listStocks(filter: StockFilter = {}, stocks: readonly StockEntry[] = STOCKS) {
  const sector = filter.sector ? normalizeSector(filter.sector) : null;
  const industry = filter.industry?.trim().toLowerCase();
  const search = filter.search?.trim().toLowerCase();
  const maxRank = filter.minLiquidity ? tierRank(filter.minLiquidity) : LIQUIDITY_TIERS.length;
  return companies(stocks)
    .filter(
      (c) =>
        (!filter.sector || c.sector === sector) &&
        (!industry || (c.industry ?? "").toLowerCase().includes(industry)) &&
        (!filter.type || c.type === filter.type) &&
        tierRank(c.liquidityTier) <= maxRank &&
        (!search ||
          c.ticker.toLowerCase().includes(search) ||
          c.companyName.toLowerCase().includes(search) ||
          c.issuers.some((i) => i.symbol.toLowerCase().includes(search))),
    )
    .sort(
      (a, b) =>
        tierRank(a.liquidityTier) - tierRank(b.liquidityTier) || a.ticker.localeCompare(b.ticker),
    );
}

export type Resolved =
  | { ok: true; ticker: string; companyName: string; candidates: StockEntry[] }
  | { ok: false; reason: string };

/**
 * A ticker (NVDA) or token symbol (NVDAx) → the registry tokens to consider.
 * A ticker means every issuer's token (the best route is chosen when buying);
 * a token symbol means that issuer's token only.
 */
export function resolveTicker(input: string, stocks: readonly StockEntry[] = STOCKS): Resolved {
  const wanted = norm(input);
  const bySymbol = stocks.filter((s) => norm(s.symbol) === wanted);
  if (bySymbol.length > 0) {
    return {
      ok: true,
      ticker: bySymbol[0]!.ticker,
      companyName: bySymbol[0]!.companyName,
      candidates: bySymbol,
    };
  }
  const byTicker = stocks.filter((s) => norm(s.ticker) === wanted);
  if (byTicker.length > 0) {
    return {
      ok: true,
      ticker: byTicker[0]!.ticker,
      companyName: byTicker[0]!.companyName,
      candidates: byTicker,
    };
  }
  return {
    ok: false,
    reason: `"${input}" isn't in Askfirst's stock registry; use listStocks to find one.`,
  };
}
