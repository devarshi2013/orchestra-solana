import { describe, expect, it, vi } from "vitest";

import { NO_WALLET, runGuestTool } from "./guest";

describe("runGuestTool", () => {
  const run = vi.fn(async () => ({ content: '{"data":[]}', isError: false }));

  it("runs research tools as usual", async () => {
    await runGuestTool("getStockMetrics", { tickers: ["NVDA"] }, run);
    expect(run).toHaveBeenCalledWith("getStockMetrics", { tickers: ["NVDA"] });
  });

  it("answers wallet tools with 'connect a wallet' and never plans", async () => {
    run.mockClear();
    const balance = await runGuestTool("getWalletBalances", {}, run);
    expect(JSON.parse(balance.content)).toEqual({ data: null, reason: NO_WALLET });
    const quote = await runGuestTool("getSwapQuote", { ticker: "NVDA", usdcAmount: 5 }, run);
    expect(quote.isError).toBe(false);
    const plan = await runGuestTool("submit_plan", { items: [] }, run);
    expect(plan).toMatchObject({ isError: true });
    expect(plan.plan).toBeUndefined();
    expect(run).not.toHaveBeenCalled();
  });
});
