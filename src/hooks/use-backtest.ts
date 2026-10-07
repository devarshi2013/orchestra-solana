"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, fetchMarketData } from "@/lib/api-client";
import type { BacktestRequest, BacktestResponse } from "@/lib/backtest/protocol";
import type { BacktestConfig, BacktestResult } from "@/lib/backtest/types";
import { collectMints } from "@/lib/symphony/mints";
import type { Symphony } from "@/lib/symphony/types";
import { SOL_MINT } from "@/lib/tokens";

export type BacktestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; result: BacktestResult; elapsedMs: number }
  | { status: "error"; message: string };

/**
 * Fetches stored prices for a symphony (plus SOL for the benchmark) and runs
 * the backtest in a Web Worker. A newer run supersedes an older one.
 */
export function useBacktest() {
  const [state, setState] = useState<BacktestState>({ status: "idle" });
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const run = useCallback(async (symphony: Symphony, config: BacktestConfig) => {
    const id = ++runIdRef.current;
    setState({ status: "running" });
    try {
      const mints = [...collectMints(symphony.root), SOL_MINT];
      const marketData = await fetchMarketData([...new Set(mints)]);
      if (id !== runIdRef.current) return;

      workerRef.current ??= new Worker(
        new URL("../lib/backtest/backtest.worker.ts", import.meta.url),
        { type: "module" },
      );
      const worker = workerRef.current;
      const response = await new Promise<BacktestResponse>((resolve, reject) => {
        const onMessage = (event: MessageEvent<BacktestResponse>) => {
          if (event.data.id !== id) return;
          worker.removeEventListener("message", onMessage);
          resolve(event.data);
        };
        worker.addEventListener("message", onMessage);
        worker.addEventListener("error", (event) => reject(new Error(event.message)), {
          once: true,
        });
        worker.postMessage({ id, symphony, marketData, config } satisfies BacktestRequest);
      });
      if (id !== runIdRef.current) return;
      setState(
        response.ok
          ? { status: "done", result: response.result, elapsedMs: response.elapsedMs }
          : { status: "error", message: response.error },
      );
    } catch (error) {
      if (id !== runIdRef.current) return;
      const message =
        error instanceof ApiError || error instanceof Error ? error.message : String(error);
      setState({ status: "error", message });
    }
  }, []);

  return { state, run };
}
