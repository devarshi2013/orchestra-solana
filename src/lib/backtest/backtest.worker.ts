import { handleBacktestRequest, type BacktestRequest, type BacktestResponse } from "./protocol";

/**
 * Runs backtests off the main thread so the page stays responsive. Created by
 * hooks/use-backtest.ts with `new Worker(new URL(...), { type: "module" })`.
 */
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<BacktestRequest>) => void) | null;
  postMessage: (message: BacktestResponse) => void;
};

scope.onmessage = (event) => {
  scope.postMessage(handleBacktestRequest(event.data));
};
