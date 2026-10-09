import { describe, expect, it } from "vitest";

import { comparisonFallbackMarkdown, parseComparison } from "./comparison";

describe("comparison blocks", () => {
  it("parses a valid block, normalising tickers and filling missing metrics with null", () => {
    const parsed = parseComparison(
      JSON.stringify({ rows: [{ company: "NVIDIA", ticker: "$nvda", marketCap: 4.4e12 }] }),
    );
    expect(parsed?.rows[0]).toEqual({
      company: "NVIDIA",
      ticker: "NVDA",
      marketCap: 4.4e12,
      return1y: null,
      pe: null,
    });
  });

  it("rejects invalid JSON or shapes", () => {
    expect(parseComparison("{rows:")).toBeNull();
    expect(parseComparison(JSON.stringify({ rows: [] }))).toBeNull();
    expect(parseComparison(JSON.stringify({ rows: [{ ticker: "NVDA", pe: "high" }] }))).toBeNull();
  });

  it("falls back to a Markdown table for rows it can't validate", () => {
    const md = comparisonFallbackMarkdown(
      JSON.stringify({ rows: [{ ticker: "NVDA", pe: "high | rising" }] }),
    );
    expect(md).toBe("| ticker | pe |\n|---|---|\n| NVDA | high \\| rising |");
    expect(comparisonFallbackMarkdown("not json")).toBeNull();
  });
});
