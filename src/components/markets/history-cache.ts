import { getJson } from "@/hooks/use-markets";
import type { WindowId } from "@/lib/market/config";
import type { Candle, Point } from "@/lib/market/series";

/** How long a loaded history is reused in this tab before asking the server again. */
const TTL_MS = 5 * 60_000;
const entries = new Map<string, { at: number; value: Promise<Point[]> }>();

/**
 * A stock's chart points for one timeframe (from /api/markets/history), oldest
 * first, one per timestamp. Kept for 5 minutes, so going back to a stock or a
 * timeframe is instant and a chart can be loaded ahead of showing it.
 * Concurrent callers share one request; failures are not kept.
 */
export function loadHistory(ticker: string, window: WindowId): Promise<Point[]> {
  const key = `${ticker}:${window}`;
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = getJson<{ candles: Candle[] }>(
    `/api/markets/history?ticker=${encodeURIComponent(ticker)}&window=${window}`,
  ).then(({ candles }) => {
    const seen = new Set<number>();
    return candles
      .filter((c) => !seen.has(c.time) && seen.add(c.time))
      .sort((a, b) => a.time - b.time)
      .map((c) => ({ time: c.time, value: c.close }));
  });
  entries.set(key, { at: Date.now(), value });
  value.catch(() => {
    if (entries.get(key)?.value === value) entries.delete(key);
  });
  return value;
}
