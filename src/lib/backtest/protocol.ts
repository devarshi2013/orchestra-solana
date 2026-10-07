import { symphonySchema } from "@/lib/symphony/schema";
import type { MarketData } from "@/lib/symphony/market-data";
import type { Symphony } from "@/lib/symphony/types";

import { runBacktest } from "./engine";
import { backtestConfigSchema, type BacktestConfig, type BacktestResult } from "./types";

/** Messages between the page and backtest.worker.ts. */
export type BacktestRequest = {
  id: number;
  symphony: Symphony;
  marketData: MarketData;
  config: BacktestConfig;
};

export type BacktestResponse =
  | { id: number; ok: true; result: BacktestResult; elapsedMs: number }
  | { id: number; ok: false; error: string };

/** Validates and runs one request; never throws, so the worker always answers. */
export function handleBacktestRequest(
  request: BacktestRequest,
  now: () => number = () => performance.now(),
): BacktestResponse {
  const started = now();
  try {
    const symphony = symphonySchema.parse(request.symphony);
    const config = backtestConfigSchema.parse(request.config);
    const result = runBacktest(symphony, request.marketData, config);
    return { id: request.id, ok: true, result, elapsedMs: now() - started };
  } catch (error) {
    return {
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
