import { describe, expect, it } from "vitest";

import { barsRequired, computeIndicator } from "./indicators";
import type { IndicatorSpec } from "./types";

describe("barsRequired", () => {
  it.each([
    [{ fn: "price" }, 1],
    [{ fn: "sma", period: 50 }, 50],
    [{ fn: "ema", period: 20 }, 40],
    [{ fn: "rsi", period: 14 }, 29],
    [{ fn: "cumulativeReturn", period: 30 }, 31],
    [{ fn: "maxDrawdown", period: 30 }, 31],
    [{ fn: "stdevReturn", period: 30 }, 31],
  ] satisfies [IndicatorSpec, number][])("%o → %i", (spec, bars) => {
    expect(barsRequired(spec)).toBe(bars);
  });
});

describe("computeIndicator", () => {
  it("price is the latest close", () => {
    expect(computeIndicator({ fn: "price" }, [1, 2, 7])).toBe(7);
  });

  it("SMA averages the last n closes only", () => {
    expect(computeIndicator({ fn: "sma", period: 3 }, [100, 2, 3, 4])).toBe(3);
  });

  it("EMA seeds with an SMA then smooths with alpha 2/(n+1)", () => {
    // seed mean(1,2)=1.5; 2/3·3 + 1/3·1.5 = 2.5; 2/3·4 + 1/3·2.5 = 3.5
    expect(computeIndicator({ fn: "ema", period: 2 }, [1, 2, 3, 4])).toBeCloseTo(3.5, 12);
  });

  it("RSI uses Wilder smoothing", () => {
    // changes +1 −1 +2 +1: seed gain/loss 0.5/0.5 → 1.25/0.25 → 1.125/0.125 → RS 9
    expect(computeIndicator({ fn: "rsi", period: 2 }, [10, 11, 10, 12, 13])).toBeCloseTo(90, 12);
  });

  it("RSI is 100 with no losses and 50 when flat", () => {
    expect(computeIndicator({ fn: "rsi", period: 2 }, [1, 2, 3, 4, 5])).toBe(100);
    expect(computeIndicator({ fn: "rsi", period: 2 }, [3, 3, 3, 3, 3])).toBe(50);
  });

  it("cumulative return is in percent over n days", () => {
    expect(computeIndicator({ fn: "cumulativeReturn", period: 2 }, [100, 50, 110, 120])).toBe(140);
  });

  it("max drawdown is the worst peak-to-trough fall in percent", () => {
    expect(computeIndicator({ fn: "maxDrawdown", period: 3 }, [100, 120, 90, 110])).toBe(25);
    expect(computeIndicator({ fn: "maxDrawdown", period: 2 }, [1, 2, 3])).toBe(0);
  });

  it("stdev of returns is the population stdev in percent", () => {
    expect(computeIndicator({ fn: "stdevReturn", period: 2 }, [100, 101, 99.99])).toBeCloseTo(
      1,
      12,
    );
  });
});
