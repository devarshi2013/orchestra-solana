import { describe, expect, it } from "vitest";

import { heroQuestion, rankHeroCandidates, shuffled, spokenName, type HeroCandidate } from "./hero";

const c = (ticker: string, o: Partial<HeroCandidate> = {}): HeroCandidate & { ticker: string } => ({
  ticker,
  category: "equity",
  preIpo: false,
  price: 100,
  volume24h: 1,
  marketCap: 1,
  tier: "high",
  ...o,
});

describe("rankHeroCandidates", () => {
  it("ranks by 24h volume and drops illiquid, pre-IPO, unpriced and non-stock rows", () => {
    const { ranked, basis } = rankHeroCandidates([
      c("A", { volume24h: 5 }),
      c("B", { volume24h: 50 }),
      c("LOW", { volume24h: 999, tier: "low" }),
      c("PRE", { volume24h: 999, preIpo: true }),
      c("ETF", { volume24h: 999, category: "etf" }),
      c("NOPRICE", { volume24h: 999, price: null }),
      c("MED", { volume24h: 20, tier: "medium" }),
      c("QUIET", { volume24h: null }),
    ]);
    expect(basis).toBe("volume");
    expect(ranked.map((r) => r.ticker)).toEqual(["B", "MED", "A"]);
  });

  it("falls back to market cap when no stock reports a volume", () => {
    const { ranked, basis } = rankHeroCandidates([
      c("A", { volume24h: null, marketCap: 5 }),
      c("B", { volume24h: null, marketCap: 50 }),
      c("C", { volume24h: 0, marketCap: null }),
    ]);
    expect(basis).toBe("marketCap");
    expect(ranked.map((r) => r.ticker)).toEqual(["B", "A"]);
  });
});

describe("hero questions", () => {
  it("uses the name people say", () => {
    expect(spokenName("Alphabet Class A")).toBe("Alphabet");
    expect(spokenName("Amazon.com")).toBe("Amazon");
    expect(spokenName("Tesla, Inc.")).toBe("Tesla");
    expect(spokenName("Coca-Cola")).toBe("Coca-Cola");
  });

  it("gives each of eight stocks a different question", () => {
    const questions = Array.from({ length: 8 }, (_, i) => heroQuestion("Tesla", i));
    expect(new Set(questions).size).toBe(8);
    expect(questions[0]).toBe("Should I buy Tesla?");
  });
});

describe("shuffled", () => {
  it("keeps every item and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffled(input, () => 0);
    expect([...out].sort()).toEqual(input);
    expect(out).not.toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
