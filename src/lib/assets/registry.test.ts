import { describe, expect, it } from "vitest";

import { base58AddressSchema } from "@/lib/jupiter/schemas";

import { CASH_ASSET, CRYPTO_ALLOWLIST } from "./allowlist";
import { CRYPTO_FILTERS, STOCK_FILTERS } from "./config";
import {
  categoryOf,
  cryptoRejection,
  curatedMints,
  indexAssets,
  selectCrypto,
  selectStocks,
  STOCK_SOURCES,
  type JupiterToken,
  type StockSource,
} from "./registry";

const NOW = Date.parse("2026-10-07T00:00:00Z");
const DAY = 86_400_000;

/** A Jupiter token that passes every crypto filter unless overridden. */
const token = (id: string, overrides: Partial<JupiterToken> = {}): JupiterToken => ({
  id,
  symbol: id.toUpperCase(),
  name: `Token ${id}`,
  decimals: 6,
  icon: null,
  isVerified: true,
  tags: ["verified"],
  liquidity: 5_000_000,
  audit: null,
  stats24h: { buyVolume: 600_000, sellVolume: 600_000 },
  firstPool: { createdAt: new Date(NOW - 365 * DAY).toISOString() },
  ...overrides,
});

const stock = (mint: string, overrides: Partial<StockSource> = {}): StockSource => ({
  issuer: "xstocks",
  symbol: `${mint}x`,
  ticker: mint,
  name: `${mint} Inc`,
  type: "Stock",
  sector: null,
  mint,
  hours: "24/5",
  ...overrides,
});

describe("official stock sources", () => {
  it("only lists Ondo and xStocks, with valid, unique Solana mints", () => {
    expect(STOCK_SOURCES.length).toBeGreaterThan(1000);
    expect(new Set(STOCK_SOURCES.map((s) => s.issuer))).toEqual(new Set(["ondo", "xstocks"]));
    expect(new Set(STOCK_SOURCES.map((s) => s.mint)).size).toBe(STOCK_SOURCES.length);
    for (const source of STOCK_SOURCES) {
      expect(base58AddressSchema.safeParse(source.mint).success, source.symbol).toBe(true);
    }
  });

  it("matches the issuers' published mints for known tickers", () => {
    const mint = (symbol: string) => STOCK_SOURCES.find((s) => s.symbol === symbol)?.mint;
    // xStocks: Solana Foundation case study / api.xstocks.fi; Ondo: docs.ondo.finance/addresses CSV.
    expect(mint("AAPLx")).toBe("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp");
    expect(mint("NVDAx")).toBe("Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh");
    expect(mint("NVDAon")).toBe("gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo");
  });
});

describe("selectStocks", () => {
  it("keeps verified stocks that trade enough, most active first", () => {
    const tokens = new Map([
      ["A", token("A", { liquidity: 200_000, stats24h: { buyVolume: 0, sellVolume: 0 } })],
      ["B", token("B", { liquidity: 5_000, stats24h: { buyVolume: 300_000, sellVolume: 0 } })], // RFQ-style: volume, no pool
      ["C", token("C", { liquidity: 9_000_000 })],
    ]);
    const { assets, rejected } = selectStocks(
      [stock("A"), stock("B", { type: "ETF" }), stock("C")],
      tokens,
    );
    expect(assets.map((a) => a.mint)).toEqual(["C", "B", "A"]);
    expect(rejected).toEqual([]);
    expect(assets.find((a) => a.mint === "B")).toMatchObject({
      kind: "stock",
      category: "ETF",
      issuer: "xstocks",
      ticker: "B",
      symbol: "B",
    });
  });

  it("rejects unknown, unverified, flagged, Backpack and illiquid tokens with reasons", () => {
    const tokens = new Map([
      ["unverified", token("unverified", { isVerified: false })],
      ["sus", token("sus", { audit: { isSus: true } })],
      ["bp", token("bp", { tags: ["verified", "backpack"] })],
      ["thin", token("thin", { liquidity: 1_000, stats24h: { buyVolume: 10, sellVolume: 10 } })],
    ]);
    const { assets, rejected } = selectStocks(
      ["missing", "unverified", "sus", "bp", "thin"].map((m) => stock(m)),
      tokens,
    );
    expect(assets).toEqual([]);
    expect(rejected.map((r) => [r.mint, r.reason])).toEqual([
      ["missing", "not_found"],
      ["unverified", "not_verified"],
      ["sus", "suspicious"],
      ["bp", "backpack"],
      ["thin", "low_liquidity"],
    ]);
  });

  it("uses the sector when the issuer gives one, and caps the list", () => {
    const tokens = new Map([
      ["A", token("A")],
      ["B", token("B")],
    ]);
    const { assets } = selectStocks([stock("A", { sector: "Technology" }), stock("B")], tokens, {
      ...STOCK_FILTERS,
      maxAssets: 1,
    });
    expect(assets).toHaveLength(1);
    expect(assets[0]!.category).toBe("Technology");
  });
});

describe("cryptoRejection", () => {
  it.each([
    ["passes every filter", {}, null],
    ["unverified", { isVerified: false }, "not_verified"],
    ["flagged", { audit: { isSus: true } }, "suspicious"],
    ["Backpack-issued", { tags: ["verified", "backpack"] }, "backpack"],
    ["a tagged stablecoin", { tags: ["verified", "stable"] }, "stablecoin"],
    ["an untagged stablecoin symbol", { symbol: "usdt" }, "stablecoin"],
    ["a tokenized stock", { tags: ["verified", "xstocks", "stocks"] }, "excluded_tag"],
    ["a yield-bearing wrapper", { tags: ["verified", "yb"] }, "excluded_tag"],
    ["thin liquidity", { liquidity: 999_999 }, "low_liquidity"],
    ["low volume", { stats24h: { buyVolume: 100, sellVolume: 100 } }, "low_volume"],
    ["too new", { firstPool: { createdAt: new Date(NOW - 30 * DAY).toISOString() } }, "too_new"],
    ["no known age", { firstPool: null, createdAt: null }, "too_new"],
  ] as const)("%s → %s", (_, overrides, reason) => {
    expect(cryptoRejection(token("x", overrides as Partial<JupiterToken>), NOW)).toBe(reason);
  });

  it("can relax the verified requirement from config", () => {
    expect(
      cryptoRejection(token("x", { isVerified: false }), NOW, {
        ...CRYPTO_FILTERS,
        requireVerified: false,
      }),
    ).toBeNull();
  });

  it("falls back to createdAt when there's no first pool", () => {
    const old = token("x", { firstPool: null, createdAt: new Date(NOW - 200 * DAY).toISOString() });
    expect(cryptoRejection(old, NOW)).toBeNull();
  });
});

describe("selectCrypto", () => {
  const curated = () =>
    new Map<string, JupiterToken>([
      ...CRYPTO_ALLOWLIST.map(
        (a) => [a.mint, token(a.mint, { symbol: a.ticker, liquidity: 10 })] as const,
      ),
      [CASH_ASSET.mint, token(CASH_ASSET.mint, { symbol: "USDC", tags: ["verified", "stable"] })],
    ]);

  it("keeps the allowlist regardless of thresholds, adds qualifying discoveries, and USDC as cash last", () => {
    const discovered = [
      token("big", { liquidity: 50_000_000, tags: ["verified", "meme"] }),
      token("tiny", { liquidity: 10 }),
      token(CRYPTO_ALLOWLIST[0].mint, { liquidity: 999_999_999 }), // already curated: not duplicated
      token("stable", { tags: ["verified", "stable"] }),
    ];
    const { assets, rejected } = selectCrypto(discovered, curated(), NOW);
    expect(rejected).toEqual([]);
    expect(assets[0]).toMatchObject({ mint: "big", category: "Meme", kind: "crypto" });
    expect(assets.filter((a) => a.mint === CRYPTO_ALLOWLIST[0].mint)).toHaveLength(1);
    expect(assets.map((a) => a.mint)).not.toContain("tiny");
    expect(assets.map((a) => a.mint)).not.toContain("stable");
    expect(assets.at(-1)).toMatchObject({ ticker: "USDC", cash: true, category: "Cash" });
    expect(assets.filter((a) => !a.cash).every((a) => a.category !== "Cash")).toBe(true);
  });

  it("drops allowlisted tokens that fail verification, and reports them", () => {
    const tokens = curated();
    tokens.set(CRYPTO_ALLOWLIST[1].mint, token(CRYPTO_ALLOWLIST[1].mint, { isVerified: false }));
    tokens.delete(CRYPTO_ALLOWLIST[2].mint);
    tokens.delete(CASH_ASSET.mint);
    const { assets, rejected } = selectCrypto([], tokens, NOW);
    expect(rejected).toEqual([
      {
        mint: CRYPTO_ALLOWLIST[1].mint,
        ticker: CRYPTO_ALLOWLIST[1].ticker,
        reason: "not_verified",
      },
      { mint: CRYPTO_ALLOWLIST[2].mint, ticker: CRYPTO_ALLOWLIST[2].ticker, reason: "not_found" },
      { mint: CASH_ASSET.mint, ticker: "USDC", reason: "not_found" },
    ]);
    expect(assets.some((a) => a.cash)).toBe(false);
  });

  it("caps investment picks at maxAssets (cash excluded) and strips a leading $ from tickers", () => {
    const discovered = Array.from({ length: 10 }, (_, i) =>
      token(`d${i}`, { symbol: `$D${i}`, liquidity: 2_000_000 + i }),
    );
    const { assets } = selectCrypto(discovered, curated(), NOW, {
      ...CRYPTO_FILTERS,
      maxAssets: 9,
    });
    expect(assets.filter((a) => !a.cash)).toHaveLength(9);
    expect(assets.find((a) => a.mint === "d9")?.ticker).toBe("D9");
  });
});

describe("helpers", () => {
  it("categorizes by Jupiter tags", () => {
    expect(categoryOf(token("x", { tags: ["lst", "major"] }))).toBe("Liquid staking");
    expect(categoryOf(token("x", { tags: null }))).toBe("Other");
  });

  it("lists curated mints and indexes assets by mint", () => {
    expect(curatedMints()).toContain(CASH_ASSET.mint);
    const { isListed, byMint } = indexAssets(selectCrypto([], new Map(), NOW).assets);
    expect(isListed(CASH_ASSET.mint)).toBe(false);
    expect(byMint.size).toBe(0);
  });

  it("has well-formed, unique allowlist mints", () => {
    const mints = curatedMints();
    expect(new Set(mints).size).toBe(mints.length);
    for (const mint of mints) expect(base58AddressSchema.safeParse(mint).success).toBe(true);
  });
});
