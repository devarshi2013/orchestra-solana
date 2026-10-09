import { describe, expect, it } from "vitest";

import {
  etfClassification,
  fromNasdaq,
  liquidityTier,
  prestocksSources,
  verifySources,
  type JupiterTokenInfo,
  type SourceEntry,
} from "./sync-core";

const source = (symbol: string, mint: string): SourceEntry => ({
  issuer: "xstocks",
  symbol,
  ticker: symbol.replace(/x$/, ""),
  companyName: symbol,
  type: "stock",
  issuerSector: null,
  mint,
  hours: "24/5",
  preIpo: false,
});
const token = (
  mint: string,
  symbol: string,
  o: Partial<JupiterTokenInfo> = {},
): JupiterTokenInfo => ({
  id: mint,
  symbol,
  decimals: 8,
  isVerified: true,
  tags: ["verified"],
  liquidity: 1000,
  audit: null,
  ...o,
});

describe("verifySources", () => {
  it("keeps only mints Jupiter verifies with the issuer's symbol, with a reason for each exclusion", () => {
    const sources = [
      source("NVDAx", "good"),
      source("AAPLx", "unverified"),
      source("TSLAx", "unknown"),
      source("SPYx", "renamed"),
      source("MSFTx", "sus"),
      source("AMZNx", "backpack"),
    ];
    const tokens = new Map(
      [
        token("good", "NVDAx"),
        token("unverified", "AAPLx", { isVerified: false }),
        token("renamed", "SPYX2"),
        token("sus", "MSFTx", { audit: { isSus: true } }),
        token("backpack", "AMZNx", { tags: ["verified", "backpack"] }),
      ].map((t) => [t.id, t]),
    );
    const { verified, excluded } = verifySources(sources, tokens);
    expect(verified.map((v) => v.source.symbol)).toEqual(["NVDAx"]);
    expect(Object.fromEntries(excluded.map((e) => [e.symbol, e.reason]))).toEqual({
      AAPLx: "Not verified by Jupiter",
      TSLAx: "Not known to Jupiter",
      SPYx: "Symbol mismatch: issuer says SPYx, Jupiter says SPYX2",
      MSFTx: "Flagged as suspicious by Jupiter",
      AMZNx: "Backpack-issued (excluded)",
    });
  });
});

describe("liquidityTier", () => {
  it("tiers by the test quote's absolute price impact and drops unbuyable tokens", () => {
    expect(liquidityTier(-0.05)).toBe("high");
    expect(liquidityTier(-0.6)).toBe("medium");
    expect(liquidityTier(-4)).toBe("low");
    expect(liquidityTier(-25)).toBeNull();
  });
});

describe("sector classification", () => {
  it("maps Nasdaq sectors to the standard ones, with overrides", () => {
    expect(fromNasdaq("JPM", "Finance", "Major Banks")).toMatchObject({ sector: "Financials" });
    expect(fromNasdaq("GOOGL", "Technology", "Computer Software")).toMatchObject({
      sector: "Communication Services",
    });
  });

  it("classifies ETFs from the fund name", () => {
    expect(etfClassification("Energy Select Sector SPDR Fund").sector).toBe("Energy");
    expect(etfClassification("SPDR S&P 500 ETF Trust").sector).toBe("Diversified");
  });
});

describe("prestocksSources", () => {
  it("reads mints from the page's product JSON", () => {
    const html = `{"symbol":"OPENAI","name":"OpenAI","industry":"AI","splMint":"PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh"}`;
    const { sources } = prestocksSources(html);
    expect(sources).toMatchObject([
      {
        issuer: "prestocks",
        symbol: "OPENAI",
        mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
        preIpo: true,
      },
    ]);
  });
});
