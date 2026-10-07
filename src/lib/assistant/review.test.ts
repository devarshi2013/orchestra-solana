import { describe, expect, it } from "vitest";

import type { SwapQuote } from "@/lib/assets/tools";

import { itemWarnings, preflight, solNeeded, type ItemQuote } from "./review";

const OPEN = new Date("2026-10-08T15:00Z"); // Thursday 11:00 ET
const WEEKEND = new Date("2026-10-10T15:00Z");

const swapQuote = (overrides: Partial<SwapQuote> = {}): SwapQuote => ({
  ticker: "NVDA",
  symbol: "NVDAx",
  usdcIn: 50,
  expectedOut: 0.27,
  minimumOut: 0.268,
  priceImpactPct: 0.05,
  thinLiquidity: false,
  feeBps: 10,
  networkFeesSol: 0.0021,
  gasless: false,
  router: "metis",
  warning: null,
  executed: false,
  quotedAt: "2026-10-08T15:00:00Z",
  ...overrides,
});
const quoted = (quote: SwapQuote | null, extra: Partial<ItemQuote> = {}): ItemQuote => ({
  symbol: quote?.symbol ?? "NVDAx",
  quote,
  reason: quote ? null : "No route",
  liquidityUsd: null,
  hours: "24/5",
  ...extra,
});

describe("itemWarnings", () => {
  it("has nothing to say about a liquid crypto buy", () => {
    expect(itemWarnings({ kind: "crypto", usdcAmount: 50 }, quoted(swapQuote()), WEEKEND)).toEqual(
      [],
    );
  });

  it("flags high and very high price impact", () => {
    const high = itemWarnings(
      { kind: "crypto", usdcAmount: 50 },
      quoted(swapQuote({ priceImpactPct: 1.5 })),
      OPEN,
    );
    expect(high).toEqual([
      { kind: "impact", severity: "warn", message: "High price impact (1.50%)" },
    ]);
    const severe = itemWarnings(
      { kind: "crypto", usdcAmount: 50 },
      quoted(swapQuote({ priceImpactPct: 7 })),
      OPEN,
    );
    expect(severe[0]!.message).toMatch(/^Very high price impact \(7\.00%\)/);
  });

  it("flags thin liquidity from the quote or the pool size", () => {
    const fromQuote = itemWarnings(
      { kind: "crypto", usdcAmount: 50 },
      quoted(swapQuote({ thinLiquidity: true })),
      OPEN,
    );
    expect(fromQuote.map((w) => w.kind)).toEqual(["liquidity"]);
    const fromPool = itemWarnings(
      { kind: "crypto", usdcAmount: 5000 },
      quoted(swapQuote(), { liquidityUsd: 100_000 }),
      OPEN,
    );
    expect(fromPool[0]!.message).toBe(
      "Thin liquidity: $100,000.00 in the pool for a $5,000.00 buy",
    );
  });

  it("warns about stocks outside US market hours only", () => {
    expect(itemWarnings({ kind: "stock", usdcAmount: 50 }, quoted(swapQuote()), OPEN)).toEqual([]);
    expect(
      itemWarnings({ kind: "stock", usdcAmount: 50 }, quoted(swapQuote()), WEEKEND).map(
        (w) => w.kind,
      ),
    ).toEqual(["market-hours"]);
  });

  it("blocks items without a buildable quote", () => {
    expect(itemWarnings({ kind: "crypto", usdcAmount: 50 }, quoted(null), OPEN)).toEqual([
      { kind: "quote", severity: "block", message: "No quote: No route" },
    ]);
    const unbuildable = itemWarnings(
      { kind: "crypto", usdcAmount: 50 },
      quoted(swapQuote({ warning: "Insufficient balance: …" })),
      OPEN,
    );
    expect(unbuildable[0]).toMatchObject({ severity: "block" });
  });
});

describe("preflight", () => {
  const items = [
    { symbol: "NVDAx", kind: "stock" as const, usdcAmount: 30 },
    { symbol: "SOL", kind: "crypto" as const, usdcAmount: 20 },
  ];
  const quotes = new Map([
    ["NVDAx", quoted(swapQuote())],
    ["SOL", quoted(swapQuote({ symbol: "SOL", gasless: true, networkFeesSol: null }))],
  ]);
  const base = {
    wallet: { connected: true, canSign: true },
    balances: { usdc: 60, sol: 0.01 },
    items,
    quotes,
    quoting: false,
    now: OPEN,
  };
  const status = (input: Parameters<typeof preflight>[0]) =>
    Object.fromEntries(preflight(input).map((c) => [c.id, c.ok]));

  it("passes a funded wallet with fresh quotes", () => {
    expect(status(base)).toEqual({
      wallet: true,
      minimum: true,
      usdc: true,
      sol: true,
      quotes: true,
    });
  });

  it("fails a disconnected or watch-only wallet", () => {
    expect(status({ ...base, wallet: { connected: false, canSign: false } }).wallet).toBe(false);
    const watchOnly = preflight({ ...base, wallet: { connected: true, canSign: false } });
    expect(watchOnly[0]).toMatchObject({ ok: false, label: expect.stringMatching(/can't sign/) });
  });

  it("enforces the minimum order size and the USDC balance", () => {
    const small = preflight({ ...base, items: [{ ...items[0]!, usdcAmount: 5 }, items[1]!] });
    expect(small[1]).toMatchObject({
      ok: false,
      label: expect.stringMatching(/raise or remove NVDAx/),
    });
    const short = preflight({ ...base, balances: { usdc: 40, sol: 1 } });
    expect(short[2]).toMatchObject({
      ok: false,
      label: "Not enough USDC: the plan needs $50.00, your wallet holds $40.00",
    });
  });

  it("needs SOL for non-gasless swaps only", () => {
    expect(solNeeded(items, quotes)).toBeCloseTo(0.0021);
    expect(status({ ...base, balances: { usdc: 60, sol: 0.001 } }).sol).toBe(false);
    // An item without a quote yet counts a conservative fee.
    expect(solNeeded([...items, { symbol: "JUP" }], quotes)).toBeCloseTo(0.0071);
  });

  it("waits while balances and quotes load, and blocks unquotable items", () => {
    expect(status({ ...base, balances: null })).toMatchObject({ usdc: null, sol: null });
    expect(status({ ...base, quoting: true }).quotes).toBeNull();
    expect(
      status({ ...base, quotes: new Map([["NVDAx", quotes.get("NVDAx")!]]) }).quotes,
    ).toBeNull();
    const blocked = new Map(quotes).set("SOL", quoted(null, { symbol: "SOL" }));
    expect(status({ ...base, quotes: blocked }).quotes).toBe(false);
  });
});
