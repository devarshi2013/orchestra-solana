import { describe, expect, it } from "vitest";

import type { EvaluationWarning } from "./evaluate";
import { describeWarning } from "./warnings";

const warning = (overrides: Partial<EvaluationWarning>): EvaluationWarning => ({
  kind: "insufficient_history",
  path: "root",
  mint: "JTO_MINT",
  indicator: { fn: "cumulativeReturn", period: 30 },
  barsNeeded: 31,
  barsAvailable: 12,
  fallback: "ranked_last",
  ...overrides,
});
const symbolOf = (mint: string) => (mint === "JTO_MINT" ? "JTO" : mint);

describe("describeWarning", () => {
  it.each([
    [
      warning({}),
      "JTO has 12 days of price history but Cumulative return(30) needs 31, so the filter ranked it last.",
    ],
    [
      warning({
        barsAvailable: 1,
        indicator: { fn: "sma", period: 50 },
        barsNeeded: 50,
        fallback: "else",
      }),
      "JTO has 1 day of price history but SMA(50) needs 50, so the condition took its else branch.",
    ],
    [
      warning({ barsAvailable: 0, fallback: "equal_weight" }),
      "JTO has no price history yet but Cumulative return(30) needs 31, so the group fell back to equal weights.",
    ],
  ])("describes %o", (input, text) => {
    expect(describeWarning(input, symbolOf)).toBe(text);
  });
});
