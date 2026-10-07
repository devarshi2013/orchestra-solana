import { describe, expect, it } from "vitest";

import { toMintTree, toTickerTree, UNLISTED, type ResolveTicker } from "./ticker-tree";

const REGISTRY: Record<string, { mint: string; symbol: string }> = {
  SOL: { mint: "So11111111111111111111111111111111111111112", symbol: "SOL" },
  USDC: { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC" },
  NVDAX: { mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", symbol: "NVDAx" },
  NVDA: { mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", symbol: "NVDAx" },
};
const resolve: ResolveTicker = (ticker) =>
  REGISTRY[ticker.toUpperCase()] ?? { reason: `"${ticker}" isn't in Orchestra's asset registry` };
const symbolOf = (mint: string) =>
  Object.values(REGISTRY).find((a) => a.mint === mint)?.symbol ?? null;

const trend = {
  name: "Trend",
  root: {
    type: "if",
    condition: {
      left: { ticker: "SOL", indicator: { fn: "price" } },
      comparator: "gt",
      right: { ticker: "SOL", indicator: { fn: "sma", period: 50 } },
    },
    then: {
      type: "group",
      name: "Risk on",
      weight: { method: "specified", percentages: [70, 30] },
      children: [
        { type: "asset", ticker: "sol" },
        { type: "asset", ticker: "NVDA" },
      ],
    },
    else: { type: "asset", ticker: "USDC" },
  },
};

describe("toMintTree", () => {
  it("resolves tickers to registry mints and canonical symbols", () => {
    const result = toMintTree(trend, resolve);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.symphony.version).toBe(1);
    expect(result.symphony.root).toMatchObject({
      type: "if",
      condition: { left: { mint: REGISTRY.SOL!.mint } },
      then: { children: [{ mint: REGISTRY.SOL!.mint }, { mint: REGISTRY.NVDAX!.mint }] },
      else: { mint: REGISTRY.USDC!.mint },
    });
    // The proposal shown to the user uses the registry's symbols.
    expect(JSON.stringify(result.tree)).toContain('"ticker":"NVDAx"');
    expect(JSON.stringify(result.tree)).not.toMatch(/[1-9A-HJ-NP-Za-km-z]{32,}/);
  });

  it("rejects unknown assets, with the path to fix", () => {
    const bad = structuredClone(trend);
    bad.root.then.children[1] = { type: "asset", ticker: "DOGE" };
    expect(toMintTree(bad, resolve)).toEqual({
      ok: false,
      errors: [`root.then.children[1]: "DOGE" isn't in Orchestra's asset registry`],
    });
  });

  it("rejects addresses in place of tickers", () => {
    const bad = structuredClone(trend);
    bad.root.else = { type: "asset", ticker: REGISTRY.USDC!.mint };
    const result = toMintTree(bad, resolve);
    expect(result.ok).toBe(false);
  });

  it("rejects weights that break the symphony rules", () => {
    const bad = structuredClone(trend);
    bad.root.then.weight = { method: "specified", percentages: [70, 20] };
    const result = toMintTree(bad, resolve);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/root\.then.*100/);
  });

  it("rejects malformed trees and oversized ones", () => {
    expect(toMintTree({ name: "x", root: { type: "asset" } }, resolve).ok).toBe(false);
    expect(toMintTree({ name: "x", root: { type: "asset", mint: "abc" } }, resolve).ok).toBe(false);
    const wide = {
      name: "Wide",
      root: {
        type: "group",
        name: "g",
        weight: { method: "equal" },
        children: Array.from({ length: 4 }, () => ({
          type: "group",
          name: "h",
          weight: { method: "equal" },
          children: Array.from({ length: 20 }, () => ({ type: "asset", ticker: "SOL" })),
        })),
      },
    };
    const result = toMintTree(wide, resolve);
    expect(result).toMatchObject({ ok: false, errors: [expect.stringMatching(/under 60/)] });
  });
});

describe("toTickerTree", () => {
  it("round-trips and never shows an unlisted mint", () => {
    const result = toMintTree(trend, resolve);
    if (!result.ok) throw new Error("expected ok");
    expect(toTickerTree(result.symphony, symbolOf)).toEqual(result.tree);
    const tree = toTickerTree(
      {
        version: 1,
        name: "x",
        root: { type: "asset", mint: "UnknownMint1111111111111111111111111111111" },
      },
      symbolOf,
    );
    expect(tree.root).toEqual({ type: "asset", ticker: UNLISTED });
  });
});
