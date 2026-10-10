import type { MarketRow } from "./types";

/**
 * Pure helpers for the home page's live sections (table rows, sector
 * averages), so the components and the tests share them.
 */

export type HomeTab = "stocks" | "etfs" | "crypto" | "gainers" | "losers";
export type HomeSortKey = "name" | "price" | "change" | "volume" | "marketCap";
export type HomeSort = { key: HomeSortKey; dir: "asc" | "desc" } | null;

export const HOME_TABS: { id: HomeTab; label: string }[] = [
  { id: "stocks", label: "Stocks" },
  { id: "etfs", label: "ETFs" },
  { id: "crypto", label: "Crypto" },
  { id: "gainers", label: "Top gainers" },
  { id: "losers", label: "Top losers" },
];

/** How many rows the home table shows. */
export const HOME_ROWS = 10;

const sortValue = (r: MarketRow, key: HomeSortKey): number | string | null =>
  key === "name"
    ? r.name
    : key === "price"
      ? r.price
      : key === "change"
        ? r.change24h
        : key === "volume"
          ? r.volume24h
          : r.marketCap;

/** Sorted copy; rows without the figure go last whichever way it's sorted. */
export function sortRows(rows: readonly MarketRow[], sort: NonNullable<HomeSort>): MarketRow[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return typeof va === "string"
      ? sign * va.localeCompare(vb as string)
      : sign * (va - (vb as number));
  });
}

/**
 * The home table's rows for a tab: the 10 largest stocks, ETFs (commodity
 * funds included) or crypto tokens by market cap, or the 10 biggest 24h
 * gainers or losers among the stocks and ETFs. `sector` narrows stocks and
 * ETFs to one sector; a column sort re-orders the tab's rows before the cut.
 */
export function homeRows(
  stocks: readonly MarketRow[],
  crypto: readonly MarketRow[],
  tab: HomeTab,
  sector: string | null,
  sort: HomeSort,
): MarketRow[] {
  const inSector = sector ? stocks.filter((r) => r.sector === sector) : stocks;
  let pool: readonly MarketRow[];
  let fallback: NonNullable<HomeSort> = { key: "marketCap", dir: "desc" };
  if (tab === "crypto") pool = crypto;
  else if (tab === "stocks") pool = inSector.filter((r) => r.category === "equity");
  else if (tab === "etfs") pool = inSector.filter((r) => r.category !== "equity");
  else {
    // Movers need a price and a 24h change; nothing is guessed for the rest.
    pool = inSector.filter(
      (r) =>
        r.price !== null &&
        r.change24h !== null &&
        (tab === "gainers" ? r.change24h > 0 : r.change24h < 0),
    );
    fallback = { key: "change", dir: tab === "gainers" ? "desc" : "asc" };
  }
  if (tab === "gainers" || tab === "losers") {
    // Movers stay the top 10 by move; a column sort only re-orders those ten.
    const top = sortRows(pool, fallback).slice(0, HOME_ROWS);
    return sort ? sortRows(top, sort) : top;
  }
  return sortRows(pool, sort ?? fallback).slice(0, HOME_ROWS);
}

export type SectorTile = {
  sector: string;
  /** Mean 24h change of the sector's companies that have one; null when none do. */
  change: number | null;
  /** Companies with a 24h change / companies in the sector. */
  counted: number;
  total: number;
};

/** One tile per sector, biggest sectors first, with the real average 24h change. */
export function sectorTiles(stocks: readonly MarketRow[]): SectorTile[] {
  const bySector = new Map<string, MarketRow[]>();
  for (const r of stocks) bySector.set(r.sector, [...(bySector.get(r.sector) ?? []), r]);
  return [...bySector]
    .map(([sector, rows]) => {
      const changes = rows.flatMap((r) => (r.change24h === null ? [] : [r.change24h]));
      return {
        sector,
        change: changes.length ? changes.reduce((s, c) => s + c, 0) / changes.length : null,
        counted: changes.length,
        total: rows.length,
      };
    })
    .sort((a, b) => b.total - a.total || a.sector.localeCompare(b.sector));
}

/** The tickers the ticker tape shows: the 12 largest priced stocks, then SOL and JUP. */
export function tapeRows(stocks: readonly MarketRow[], crypto: readonly MarketRow[]): MarketRow[] {
  const top = sortRows(
    stocks.filter((r) => r.price !== null),
    { key: "marketCap", dir: "desc" },
  ).slice(0, 12);
  return [...top, ...crypto.filter((c) => c.ticker === "SOL" || c.ticker === "JUP")];
}
