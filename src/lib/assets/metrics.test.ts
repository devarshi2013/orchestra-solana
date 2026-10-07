import { describe, expect, it } from "vitest";

import { annualizedVolatility, returnOver, type PricePoint } from "./metrics";

const DAY = 86_400_000;
const T0 = Date.parse("2025-10-07T00:00:00Z");
/** One point a day from T0, with the given prices. */
const daily = (prices: number[]): PricePoint[] => prices.map((p, i) => [T0 + i * DAY, p]);

describe("returnOver", () => {
  it("compares the latest price with the price `days` ago", () => {
    const points = daily([100, 110, 120, 130, 140, 150, 160, 175]); // 8 days
    expect(returnOver(points, 7)).toBeCloseTo(75, 12); // 100 → 175
    expect(returnOver(points, 1)).toBeCloseTo((175 / 160 - 1) * 100, 12);
  });

  it("uses the last price on or before the target, tolerating an intraday final point", () => {
    const points: PricePoint[] = [...daily([100, 200]), [T0 + DAY + 9 * 3_600_000, 210]];
    // 1 day before 09:00 on day 1 is 09:00 on day 0 → base is day 0's 100.
    expect(returnOver(points, 1)).toBeCloseTo(110, 12);
  });

  it("is null when history is too short or unusable", () => {
    expect(returnOver(daily([100, 110]), 7)).toBeNull();
    expect(returnOver(daily([100]), 1)).toBeNull();
    expect(returnOver(daily([0, 110]), 1)).toBeNull();
  });
});

describe("annualizedVolatility", () => {
  it("is the sample stdev of daily returns × √365, in percent", () => {
    // Returns +10%, −10%, +10%, −10%: mean 0, sample variance 4·0.01/3.
    const points = daily([100, 110, 99, 108.9, 98.01]);
    expect(annualizedVolatility(points, 4)).toBeCloseTo(
      Math.sqrt(0.04 / 3) * Math.sqrt(365) * 100,
      9,
    );
  });

  it("uses only the last `window` returns", () => {
    const calmTail = daily([1, 50, 1, 50, 100, 100, 100, 100]);
    expect(annualizedVolatility(calmTail, 3)).toBe(0);
  });

  it("is null without window + 1 prices", () => {
    expect(annualizedVolatility(daily([1, 2, 3]), 3)).toBeNull();
  });
});
