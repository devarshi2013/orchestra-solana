import { describe, expect, it } from "vitest";

import { formatBaseUnits, parseAmountToBaseUnits } from "./amount";

describe("parseAmountToBaseUnits", () => {
  it.each([
    ["1", 9, 1_000_000_000n],
    ["1.5", 6, 1_500_000n],
    [".5", 6, 500_000n],
    ["0.000001", 6, 1n],
    ["10.", 2, 1000n],
    ["0", 6, 0n],
  ])("parses %s with %i decimals", (input, decimals, expected) => {
    expect(parseAmountToBaseUnits(input, decimals)).toBe(expected);
  });

  it.each(["", ".", "abc", "1.2.3", "-1", "1e5", "0.0000001"])("rejects %j", (input) => {
    expect(parseAmountToBaseUnits(input, 6)).toBeNull();
  });
});

describe("formatBaseUnits", () => {
  it("formats with grouping and trims trailing zeros", () => {
    expect(formatBaseUnits("1234500000", 6)).toBe("1,234.5");
    expect(formatBaseUnits(1_000_000_000n, 9)).toBe("1");
  });

  it("truncates to maxFractionDigits", () => {
    expect(formatBaseUnits("123456789", 9, 4)).toBe("0.1234");
  });
});
