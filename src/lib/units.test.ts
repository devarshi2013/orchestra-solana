import { describe, expect, it } from "vitest";

import { toBaseUnits, toUnits } from "./units";

describe("toBaseUnits", () => {
  it("rounds down to whole base units", () => {
    expect(toBaseUnits(1.5, 9)).toBe(1_500_000_000n);
    expect(toBaseUnits(0.1234567, 6)).toBe(123_456n);
    expect(toBaseUnits(0, 6)).toBe(0n);
    expect(toBaseUnits(-1, 6)).toBe(0n);
    expect(toBaseUnits(0.9999999, 6)).toBe(999_999n); // toFixed would round up to 1.000000
  });
});

describe("toUnits", () => {
  it("converts base units to whole tokens", () => {
    expect(toUnits("1500000", 6)).toBe(1.5);
    expect(toUnits(2n, 0)).toBe(2);
  });
});
