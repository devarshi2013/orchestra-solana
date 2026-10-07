import { describe, expect, it } from "vitest";

import { SOL_MINT, USDC_MINT } from "@/lib/tokens";

import { JUP_MINT, solanaMomentumTop3, solJup6040, solTrendFollower } from "./examples";
import { collectMints } from "./mints";

describe("collectMints", () => {
  it("collects held mints and mints read by conditions", () => {
    expect([...collectMints(solTrendFollower.root)]).toEqual([SOL_MINT, USDC_MINT]);
    expect([...collectMints(solJup6040.root)]).toEqual([SOL_MINT, JUP_MINT]);
    expect(collectMints(solanaMomentumTop3.root).size).toBe(6);
  });

  it("includes a mint compared on the right of a condition", () => {
    const mints = collectMints({
      type: "if",
      condition: {
        left: { mint: "A", indicator: { fn: "price" } },
        comparator: "gt",
        right: { mint: "B", indicator: { fn: "price" } },
      },
      then: { type: "asset", mint: "C" },
      else: { type: "asset", mint: "A" },
    });
    expect([...mints]).toEqual(["A", "B", "C"]);
  });
});
