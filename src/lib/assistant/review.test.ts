import { describe, expect, it } from "vitest";

import type { SwapQuote } from "@/lib/stocks/tools";

import { itemWarnings, preflight, solNeeded, type ItemQuote } from "./review";

const OPEN = new Date("2026-10-08T15:00Z"); // Thursday 11:00 ET
const WEEKEND = new Date("2026-10-10T15:00Z");

const swapQuote = (overrides: Partial<SwapQuote> = {}): SwapQuote => ({
  ticker: "NVDA",
  companyName: "NVIDIA",
  symbol: "NVDAx",
  issuer: "xStocks (Backed)",
  liquidityTier: "high",
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
  issuersCompared: [],
  executed: false,
  quotedAt: "2026-10-08T15:00:00Z",
  ...overrides,
});
const quoted = (quote: SwapQuote | null, extra: Partial<ItemQuote> = {}): ItemQuote => ({
  symbol: quote?.symbol ?? "NVDAx",
  quote,
  reason: quote ? null : "No route",
  token: {
    symbol: quote?.symbol ?? "NVDAx",
    issuer: "xStocks (Backed)",
    mint: "mint",
    decimals: 8,
    liquidityTier: "high",
    hours: "24/5",
    preIpo: false,
  },
  ...extra,
});

describe("itemWarnings", () => {
  it("has nothing to say about a liquid stock in market hours", () => {
    expect(itemWarnings({ kind: "stock", usdcAmount: 50 }, quoted(swapQuote()), OPEN)).toEqual([]);
  });

  it("flags high and very high price impact", () => {
    const high = itemWarnings(
      { kind: "stock", usdcAmount: 50 },
      quoted(swapQuote({ priceImpactPct: 1.5 })),
      OPEN,
    );
    expect(high).toEqual([
      { kind: "impact", severity: "warn", message: "High price impact (1.50%)" },
    ]);
    const severe = itemWarnings(
      { kind: "stock", usdcAmount: 50 },
      quoted(swapQuote({ priceImpactPct: 7 })),
      OPEN,
    );
    expect(severe[0]!.message).toMatch(/^Very high price impact \(7\.00%\)/);
  });

  it("flags thin liquidity from the quote or a low-liquidity token", () => {
    const fromQuote = itemWarnings(
      { kind: "stock", usdcAmount: 50 },
      quoted(swapQuote({ thinLiquidity: true })),
      OPEN,
    );
    expect(fromQuote.map((w) => w.kind)).toEqual(["liquidity"]);
    const low = quoted(swapQuote());
    const fromTier = itemWarnings(
      { kind: "stock", usdcAmount: 50 },
      { ...low, token: { ...low.token!, liquidityTier: "low" } },
      OPEN,
    );
    expect(fromTier[0]!.message).toBe("Low liquidity: NVDAx moves noticeably even on small buys");
  });

  it("warns about stocks outside US market hours, except pre-IPO tokens", () => {
    const pre = quoted(swapQuote());
    expect(
      itemWarnings(
        { kind: "stock", usdcAmount: 50 },
        { ...pre, token: { ...pre.token!, preIpo: true } },
        WEEKEND,
      ),
    ).toEqual([]);
    expect(itemWarnings({ kind: "stock", usdcAmount: 50 }, quoted(swapQuote()), OPEN)).toEqual([]);
    expect(
      itemWarnings({ kind: "stock", usdcAmount: 50 }, quoted(swapQuote()), WEEKEND).map(
        (w) => w.kind,
      ),
    ).toEqual(["market-hours"]);
  });

  it("blocks items without a buildable quote", () => {
    expect(itemWarnings({ kind: "stock", usdcAmount: 50 }, quoted(null), OPEN)).toEqual([
      {
        kind: "quote",
        severity: "block",
        message: "This stock can't be traded right now. Try a smaller amount or try again later.",
      },
    ]);
    const unbuildable = itemWarnings(
      { kind: "stock", usdcAmount: 50 },
      quoted(swapQuote({ warning: "Insufficient balance: …" })),
      OPEN,
    );
    expect(unbuildable).toEqual([
      { kind: "quote", severity: "block", message: "Not enough USDC for this trade." },
    ]);
  });
});

describe("preflight", () => {
  const items = [
    { symbol: "NVDAx", kind: "stock" as const, usdcAmount: 30 },
    { symbol: "SPY", kind: "stock" as const, usdcAmount: 20 },
  ];
  const quotes = new Map([
    ["NVDAx", quoted(swapQuote())],
    ["SPY", quoted(swapQuote({ symbol: "SPYon", gasless: true, networkFeesSol: null }))],
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
    expect(solNeeded([...items, { symbol: "AAPL" }], quotes)).toBeCloseTo(0.0071);
  });

  it("waits while balances and quotes load, and blocks unquotable items", () => {
    expect(status({ ...base, balances: null })).toMatchObject({ usdc: null, sol: null });
    expect(status({ ...base, quoting: true }).quotes).toBeNull();
    expect(
      status({ ...base, quotes: new Map([["NVDAx", quotes.get("NVDAx")!]]) }).quotes,
    ).toBeNull();
    const blocked = new Map(quotes).set("SPY", quoted(null, { symbol: "SPY" }));
    expect(status({ ...base, quotes: blocked }).quotes).toBe(false);
  });
});
