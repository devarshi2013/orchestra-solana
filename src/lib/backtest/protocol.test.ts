import { describe, expect, it } from "vitest";

import { JUP_MINT, solJup6040 } from "@/lib/symphony/examples";
import { SOL_MINT } from "@/lib/tokens";

import { handleBacktestRequest } from "./protocol";
import type { BacktestConfig } from "./types";

const config: BacktestConfig = {
  startDate: "2026-03-02",
  endDate: "2026-03-03",
  rebalance: { kind: "daily" },
  startingCapitalUsdc: 1000,
  feeBps: 0,
  slippageBps: 0,
};
const marketData = {
  dates: ["2026-03-01", "2026-03-02", "2026-03-03"],
  closes: { [SOL_MINT]: [100, 110, 121], [JUP_MINT]: [1, 1, 1] },
};
let clock = 0;
const now = () => (clock += 5);

describe("handleBacktestRequest", () => {
  it("answers with the result and how long it took", () => {
    const response = handleBacktestRequest(
      { id: 7, symphony: solJup6040, marketData, config },
      now,
    );
    expect(response).toMatchObject({ id: 7, ok: true, elapsedMs: 5 });
    expect(response.ok && response.result.equity).toHaveLength(3);
  });

  it("answers with an error instead of throwing", () => {
    expect(
      handleBacktestRequest(
        {
          id: 8,
          symphony: solJup6040,
          marketData,
          config: { ...config, startDate: "2030-01-01", endDate: "2030-01-02" },
        },
        now,
      ),
    ).toMatchObject({ id: 8, ok: false, error: expect.stringContaining("No trading days") });
    expect(
      handleBacktestRequest({ id: 9, symphony: { name: "bad" } as never, marketData, config }, now),
    ).toMatchObject({ id: 9, ok: false });
  });
});
