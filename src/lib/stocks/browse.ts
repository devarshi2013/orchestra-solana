/**
 * Filtering, sorting and URL state for the "Browse stocks" panel. Pure, so
 * the panel and the tests share it. Filters combine (AND); counts per sector
 * apply every other filter, so they say what picking that sector would show.
 */

import type { LiquidityTier } from "./types";

/** What the panel needs of each company (as GET /api/stocks returns it). */
export type BrowseCompany = {
  ticker: string;
  companyName: string;
  type: "stock" | "etf";
  sector: string;
  industry: string | null;
  liquidityTier: LiquidityTier;
  issuers: { symbol: string }[];
};

/** Per-ticker figures to sort by; null where there's no data. */
export type BrowseMetrics = {
  marketCap: number | null;
  change24h: number | null;
  return1y: number | null;
};

export const STANDARD_SECTORS = [
  "Technology",
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Financials",
  "Health Care",
  "Industrials",
  "Energy",
  "Materials",
  "Utilities",
  "Real Estate",
] as const;

export type TypeFilter = "all" | "stock" | "etf";
/** "high": high only; "medium": high and medium (Medium+). */
export type LiquidityFilter = "any" | "high" | "medium";
export type SortKey = "liquidity" | "mcap" | "change" | "return" | "name";
export type SortDir = "asc" | "desc";

export type BrowseFilters = {
  search: string;
  sectors: string[];
  industries: string[];
  type: TypeFilter;
  liquidity: LiquidityFilter;
  sort: SortKey;
  dir: SortDir;
};

export const DEFAULT_FILTERS: BrowseFilters = {
  search: "",
  sectors: [],
  industries: [],
  type: "all",
  liquidity: "any",
  sort: "liquidity",
  dir: "desc",
};

/** The natural direction for each sort: biggest first, A to Z for names. */
export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  liquidity: "desc",
  mcap: "desc",
  change: "desc",
  return: "desc",
  name: "asc",
};

/** "Consumer Discretionary" → "consumer-discretionary" (for the URL). */
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// --- URL state ------------------------------------------------------------------

const SORTS: SortKey[] = ["liquidity", "mcap", "change", "return", "name"];

/**
 * Filters from the query string (?sector=technology,energy&type=etf&sort=mcap).
 * Sector and industry slugs are matched against the names that exist, so an
 * unknown or edited value is simply dropped.
 */
export function filtersFromParams(
  params: URLSearchParams,
  known: { sectors: string[]; industries: string[] },
): BrowseFilters {
  const list = (key: string, names: string[]) => {
    const wanted = new Set((params.get(key) ?? "").split(",").filter(Boolean));
    return names.filter((n) => wanted.has(slug(n)));
  };
  const type = params.get("type");
  const liquidity = params.get("liquidity");
  const sort = params.get("sort") as SortKey | null;
  const dir = params.get("dir");
  const sortKey = sort && SORTS.includes(sort) ? sort : DEFAULT_FILTERS.sort;
  return {
    search: (params.get("find") ?? "").slice(0, 80),
    sectors: list("sector", known.sectors),
    industries: list("industry", known.industries),
    type: type === "stock" || type === "etf" ? type : "all",
    liquidity: liquidity === "high" || liquidity === "medium" ? liquidity : "any",
    sort: sortKey,
    dir: dir === "asc" || dir === "desc" ? dir : DEFAULT_DIR[sortKey],
  };
}

/** The filters' query parameters; defaults are left out. Other parameters are kept. */
export function filtersToParams(filters: BrowseFilters, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  const set = (key: string, value: string | null) =>
    value ? params.set(key, value) : params.delete(key);
  set("find", filters.search.trim() || null);
  set("sector", filters.sectors.map(slug).join(",") || null);
  set("industry", filters.industries.map(slug).join(",") || null);
  set("type", filters.type === "all" ? null : filters.type);
  set("liquidity", filters.liquidity === "any" ? null : filters.liquidity);
  set("sort", filters.sort === DEFAULT_FILTERS.sort ? null : filters.sort);
  set("dir", filters.dir === DEFAULT_DIR[filters.sort] ? null : filters.dir);
  return params;
}

// --- Filtering ------------------------------------------------------------------

const matchesSearch = (c: BrowseCompany, query: string) => {
  const q = query.trim().toLowerCase();
  return (
    !q ||
    c.ticker.toLowerCase().includes(q) ||
    c.companyName.toLowerCase().includes(q) ||
    c.issuers.some((i) => i.symbol.toLowerCase().includes(q))
  );
};

const matchesLiquidity = (c: BrowseCompany, filter: LiquidityFilter) =>
  filter === "any" ||
  c.liquidityTier === "high" ||
  (filter === "medium" && c.liquidityTier === "medium");

type Except = "sector" | "industry" | null;

function matches(c: BrowseCompany, f: BrowseFilters, except: Except = null) {
  return (
    matchesSearch(c, f.search) &&
    (f.type === "all" || c.type === f.type) &&
    matchesLiquidity(c, f.liquidity) &&
    (except === "sector" || f.sectors.length === 0 || f.sectors.includes(c.sector)) &&
    (except === "sector" ||
      except === "industry" ||
      f.industries.length === 0 ||
      (c.industry !== null && f.industries.includes(c.industry)))
  );
}

const TIER_RANK: Record<LiquidityTier, number> = { high: 2, medium: 1, low: 0 };

/** The companies that pass every filter, in the chosen order (missing figures last). */
export function applyFilters<T extends BrowseCompany>(
  companies: readonly T[],
  filters: BrowseFilters,
  metrics: Record<string, BrowseMetrics> = {},
): T[] {
  const shown = companies.filter((c) => matches(c, filters));
  const value = (c: BrowseCompany): number | null => {
    const m = metrics[c.ticker];
    switch (filters.sort) {
      case "mcap":
        return m?.marketCap ?? null;
      case "change":
        return m?.change24h ?? null;
      case "return":
        return m?.return1y ?? null;
      case "liquidity":
        return TIER_RANK[c.liquidityTier];
      default:
        return null;
    }
  };
  const sign = filters.dir === "asc" ? 1 : -1;
  // Array.sort is stable: ties keep the registry's order (most liquid first, then A-Z).
  return [...shown].sort((a, b) => {
    if (filters.sort === "name") return sign * a.companyName.localeCompare(b.companyName);
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return sign * (va - vb);
  });
}

/** Sectors to offer, standard ones first, with how many companies each would show. */
export function sectorOptions(
  companies: readonly BrowseCompany[],
  filters: BrowseFilters,
): { name: string; count: number }[] {
  const present = new Set(companies.map((c) => c.sector));
  const names = [
    ...STANDARD_SECTORS.filter((s) => present.has(s)),
    ...[...present].filter((s) => !(STANDARD_SECTORS as readonly string[]).includes(s)).sort(),
  ];
  const pool = companies.filter((c) => matches(c, filters, "sector"));
  return names.map((name) => ({ name, count: pool.filter((c) => c.sector === name).length }));
}

/** Industries within the chosen sectors (none until one is chosen), with counts. */
export function industryOptions(
  companies: readonly BrowseCompany[],
  filters: BrowseFilters,
): { name: string; count: number }[] {
  if (filters.sectors.length === 0) return [];
  const counts = new Map<string, number>();
  for (const c of companies) {
    if (!c.industry || !filters.sectors.includes(c.sector)) continue;
    if (!matches(c, filters, "industry")) continue;
    counts.set(c.industry, (counts.get(c.industry) ?? 0) + 1);
  }
  // Keep chosen industries listed even when other filters hide all their companies.
  for (const i of filters.industries) if (!counts.has(i)) counts.set(i, 0);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Sectors changed: keep only the chosen industries that are still inside them. */
export function withSectors(
  companies: readonly BrowseCompany[],
  filters: BrowseFilters,
  sectors: string[],
): BrowseFilters {
  const allowed = new Set(
    companies.filter((c) => sectors.includes(c.sector)).map((c) => c.industry),
  );
  return { ...filters, sectors, industries: filters.industries.filter((i) => allowed.has(i)) };
}

/** How many filters (not search or sort) are set: the mobile "Filters (n)" badge. */
export function activeFilterCount(f: BrowseFilters): number {
  return (
    (f.sectors.length > 0 ? 1 : 0) +
    (f.industries.length > 0 ? 1 : 0) +
    (f.type !== "all" ? 1 : 0) +
    (f.liquidity !== "any" ? 1 : 0)
  );
}
