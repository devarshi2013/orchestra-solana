import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, { JUPITER_API_KEY: "jup_test_key" });
});

import { companyPrice } from "./screener";

const tokens = [
  { mint: "on", issuer: "ondo" },
  { mint: "x", issuer: "xstocks" },
];
const p = (price: number) => ({ price, change24h: 1 });

describe("companyPrice", () => {
  it("prefers the xStocks price (it matches the chart and real trades)", () => {
    expect(companyPrice(tokens, "on", { on: p(704), x: p(534) })).toEqual(p(534));
    expect(companyPrice(tokens, "on", { on: p(397), x: p(383) })).toEqual(p(383));
  });

  it("uses the traded token's price when there is no xStocks price", () => {
    expect(companyPrice(tokens, "on", { on: p(100) })).toEqual(p(100));
    expect(companyPrice([{ mint: "on", issuer: "ondo" }], "on", { on: p(100) })).toEqual(p(100));
  });

  it("shows no price when other issuers disagree by more than 5%", () => {
    const others = [
      { mint: "a", issuer: "ondo" },
      { mint: "b", issuer: "prestocks" },
    ];
    expect(companyPrice(others, "a", { a: p(100), b: p(120) })).toBeNull();
    expect(companyPrice(others, "a", { a: p(100), b: p(103) })).toEqual(p(100));
    expect(companyPrice(others, "a", {})).toBeNull();
  });
});
