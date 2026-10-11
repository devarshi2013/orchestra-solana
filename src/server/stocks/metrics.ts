import "server-only";

import { STOCKS } from "@/lib/stocks/registry";
import { cached } from "@/server/cache";
import { fetchBatchPriceChange, fetchBatchQuotes, fmpConfigured } from "@/server/market/fmp";

/**
 * The real companies' market caps and 1Y returns for every registry ticker,
 * from Financial Modeling Prep's batch endpoints, only when
 * MARKET_DATA_API_KEY is set and the plan allows them. Otherwise they're
 * reported unavailable, never estimated.
 */

const FUNDAMENTALS_TTL_MS = 24 * 3_600_000;
const FMP_BATCH = 100;

const chunks = <T>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  );

type Fundamentals = {
  marketCap: Record<string, number | null> | null;
  return1y: Record<string, number | null> | null;
};

/** Market caps and 1Y returns from FMP's batch endpoints; each null when unavailable. */
export function fundamentals(): Promise<Fundamentals> {
  return cached("browse:fundamentals", FUNDAMENTALS_TTL_MS, async () => {
    if (!fmpConfigured()) return { marketCap: null, return1y: null };
    const symbols = [...new Set(STOCKS.map((s) => s.ticker))];
    const load = async <R>(
      name: string,
      fetchBatch: (s: string[]) => Promise<R[]>,
      pick: (r: R) => [string, number | null],
    ) => {
      try {
        const out: Record<string, number | null> = {};
        for (const batch of chunks(symbols, FMP_BATCH)) {
          for (const row of await fetchBatch(batch)) {
            const [symbol, value] = pick(row);
            out[symbol] = value;
          }
        }
        return Object.keys(out).length > 0 ? out : null;
      } catch (error) {
        // Most often the plan doesn't include batch endpoints: the sort stays off.
        console.warn(
          `[browse] ${name} unavailable:`,
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    };
    const [marketCap, return1y] = await Promise.all([
      load("market caps", fetchBatchQuotes, (r) => [r.symbol, r.marketCap ?? null]),
      load("1Y returns", fetchBatchPriceChange, (r) => [r.symbol, r["1Y"] ?? null]),
    ]);
    return { marketCap, return1y };
  });
}
