import { z } from "zod";

import { CASH_ASSET, CRYPTO_ALLOWLIST } from "./allowlist";
import { CRYPTO_FILTERS, STOCK_FILTERS, type CryptoFilters, type StockFilters } from "./config";
import stockSources from "./data/stock-sources.json";

/**
 * The investable-asset registry: the only place Orchestra gets mint addresses
 * from. Candidates come from issuers' official lists (stocks) and Jupiter's
 * verified list plus a curated allowlist (crypto); each one is checked
 * against Jupiter's Tokens API before it's listed. Pure and client-safe; the
 * server builds and caches the live list (src/server/assets/registry.ts).
 */

export type CryptoCategory =
  "Major" | "Liquid staking" | "DeFi" | "Infrastructure" | "Meme" | "Other" | "Cash";
export type StockIssuer = "ondo" | "xstocks";

export type Asset = {
  kind: "stock" | "crypto";
  /** Display ticker: the underlying for stocks (AAPL), the token symbol for crypto. */
  ticker: string;
  name: string;
  /** Sector for stocks (falls back to Stock/ETF), category for crypto. */
  category: string;
  mint: string;
  /** Tokenized stocks only. */
  issuer?: StockIssuer;
  /** The token's own symbol, e.g. AAPLx or AAPLon. */
  symbol: string;
  decimals: number;
  icon: string | null;
  /** Stocks only: issuer trading schedule. */
  hours?: string;
  /** USDC: holdable as cash, never an investment pick. */
  cash?: boolean;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
};

export const ISSUER_NAMES: Record<StockIssuer, string> = {
  ondo: "Ondo Global Markets",
  xstocks: "xStocks (Backed)",
};

/** The fields of Jupiter's MintInformation the checks read. */
export const jupiterTokenSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.number().int().nonnegative(),
  icon: z.string().nullish(),
  isVerified: z.boolean().nullish(),
  tags: z.array(z.string()).nullish(),
  liquidity: z.number().nullish(),
  audit: z.object({ isSus: z.boolean().nullish() }).nullish(),
  stats24h: z
    .object({ buyVolume: z.number().nullish(), sellVolume: z.number().nullish() })
    .nullish(),
  firstPool: z.object({ createdAt: z.string().nullish() }).nullish(),
  createdAt: z.string().nullish(),
});
export type JupiterToken = z.infer<typeof jupiterTokenSchema>;

export type StockSource = {
  issuer: StockIssuer;
  symbol: string;
  ticker: string;
  name: string;
  type: "Stock" | "ETF";
  sector: string | null;
  mint: string;
  hours: string;
};

export const STOCK_SOURCES = (stockSources as { assets: StockSource[] }).assets;

export type RejectReason =
  | "not_found"
  | "not_verified"
  | "suspicious"
  | "backpack"
  | "excluded_tag"
  | "stablecoin"
  | "low_liquidity"
  | "low_volume"
  | "too_new";
export type Rejection = { mint: string; ticker: string; reason: RejectReason };

export const volume24h = (token: JupiterToken) =>
  (token.stats24h?.buyVolume ?? 0) + (token.stats24h?.sellVolume ?? 0);

const ageDays = (token: JupiterToken, now: number) => {
  const created = Date.parse(token.firstPool?.createdAt ?? token.createdAt ?? "");
  return Number.isNaN(created) ? null : (now - created) / 86_400_000;
};

/** Checks every list needs: Jupiter knows it, has verified it, and hasn't flagged it. */
function verify(token: JupiterToken | undefined, requireVerified = true): RejectReason | null {
  if (!token) return "not_found";
  if (requireVerified && !token.isVerified) return "not_verified";
  if (token.audit?.isSus) return "suspicious";
  if (token.tags?.includes("backpack")) return "backpack";
  return null;
}

const toAsset = (
  token: JupiterToken,
  base: Omit<Asset, "decimals" | "icon" | "liquidityUsd" | "volume24hUsd" | "symbol">,
): Asset => ({
  ...base,
  symbol: token.symbol,
  decimals: token.decimals,
  icon: token.icon ?? null,
  liquidityUsd: token.liquidity ?? null,
  volume24hUsd: volume24h(token),
});

/**
 * Tokenized stocks from official sources that Jupiter verifies and that
 * trade enough (liquidity OR 24h volume), most liquid first.
 */
export function selectStocks(
  sources: readonly StockSource[],
  tokens: ReadonlyMap<string, JupiterToken>,
  filters: StockFilters = STOCK_FILTERS,
): { assets: Asset[]; rejected: Rejection[] } {
  const assets: Asset[] = [];
  const rejected: Rejection[] = [];
  for (const source of sources) {
    const token = tokens.get(source.mint);
    const reason =
      verify(token, filters.requireVerified) ??
      ((token!.liquidity ?? 0) < filters.minLiquidityUsd &&
      volume24h(token!) < filters.minVolume24hUsd
        ? "low_liquidity"
        : null);
    if (reason) {
      rejected.push({ mint: source.mint, ticker: source.symbol, reason });
      continue;
    }
    assets.push(
      toAsset(token!, {
        kind: "stock",
        ticker: source.ticker,
        name: source.name,
        category: source.sector ?? source.type,
        mint: source.mint,
        issuer: source.issuer,
        hours: source.hours,
      }),
    );
  }
  assets.sort(
    (a, b) =>
      (b.liquidityUsd ?? 0) +
      (b.volume24hUsd ?? 0) -
      ((a.liquidityUsd ?? 0) + (a.volume24hUsd ?? 0)),
  );
  return { assets: assets.slice(0, filters.maxAssets), rejected };
}

const CATEGORY_TAGS: [string, CryptoCategory][] = [
  ["lst", "Liquid staking"],
  ["major", "Major"],
  ["meme", "Meme"],
  ["defi", "DeFi"],
  ["infra", "Infrastructure"],
];
export const categoryOf = (token: JupiterToken): CryptoCategory =>
  CATEGORY_TAGS.find(([tag]) => token.tags?.includes(tag))?.[1] ?? "Other";

const isStablecoin = (token: JupiterToken, filters: CryptoFilters) =>
  token.tags?.includes("stable") || filters.stablecoinSymbols.includes(token.symbol.toUpperCase());

/**
 * Why a discovered token doesn't qualify as a crypto investment, or null.
 * Order: verification, exclusions, then liquidity, volume and age.
 */
export function cryptoRejection(
  token: JupiterToken,
  now: number,
  filters: CryptoFilters = CRYPTO_FILTERS,
): RejectReason | null {
  const unverified = verify(token, filters.requireVerified);
  if (unverified) return unverified;
  if (isStablecoin(token, filters)) return "stablecoin";
  if (token.tags?.some((tag) => filters.excludeTags.includes(tag))) return "excluded_tag";
  if ((token.liquidity ?? 0) < filters.minLiquidityUsd) return "low_liquidity";
  if (volume24h(token) < filters.minVolume24hUsd) return "low_volume";
  const age = ageDays(token, now);
  if (age === null || age < filters.minAgeDays) return "too_new";
  return null;
}

/**
 * The crypto list: the curated allowlist (verified, but exempt from the
 * discovery thresholds) plus discovered tokens that pass every filter, then
 * USDC as cash. Most liquid first; capped at `maxAssets`.
 */
export function selectCrypto(
  discovered: readonly JupiterToken[],
  allowlistTokens: ReadonlyMap<string, JupiterToken>,
  now: number,
  filters: CryptoFilters = CRYPTO_FILTERS,
): { assets: Asset[]; rejected: Rejection[] } {
  const rejected: Rejection[] = [];
  const curated: Asset[] = [];
  for (const entry of CRYPTO_ALLOWLIST) {
    const token = allowlistTokens.get(entry.mint);
    const reason = verify(token);
    if (reason) rejected.push({ mint: entry.mint, ticker: entry.ticker, reason });
    else
      curated.push(
        toAsset(token!, {
          kind: "crypto",
          ticker: entry.ticker,
          name: entry.name,
          category: entry.category,
          mint: entry.mint,
        }),
      );
  }
  const taken = new Set(curated.map((a) => a.mint));
  const found: Asset[] = [];
  for (const token of discovered) {
    if (taken.has(token.id)) continue;
    const reason = cryptoRejection(token, now, filters);
    if (reason) continue; // thousands of verified tokens; only allowlist rejections are reported
    taken.add(token.id);
    found.push(
      toAsset(token, {
        kind: "crypto",
        ticker: token.symbol.replace(/^\$/, ""),
        name: token.name,
        category: categoryOf(token),
        mint: token.id,
      }),
    );
  }
  const byLiquidity = (a: Asset, b: Asset) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
  const assets = [...curated, ...found.sort(byLiquidity)]
    .slice(0, filters.maxAssets)
    .sort(byLiquidity);

  const cash = allowlistTokens.get(CASH_ASSET.mint);
  const cashReason = verify(cash);
  if (cashReason)
    rejected.push({ mint: CASH_ASSET.mint, ticker: CASH_ASSET.ticker, reason: cashReason });
  else
    assets.push(
      toAsset(cash!, {
        kind: "crypto",
        ticker: CASH_ASSET.ticker,
        name: CASH_ASSET.name,
        category: CASH_ASSET.category,
        mint: CASH_ASSET.mint,
        cash: true,
      }),
    );
  return { assets, rejected };
}

/** Mints the curated lists need looked up (allowlist + cash). */
export const curatedMints = (): string[] => [
  ...CRYPTO_ALLOWLIST.map((a) => a.mint),
  CASH_ASSET.mint,
];

/** A registry lookup: `isListed(mint)` is the gate for any mint Orchestra will trade. */
export function indexAssets(assets: readonly Asset[]) {
  const byMint = new Map(assets.map((asset) => [asset.mint, asset]));
  return { byMint, isListed: (mint: string) => byMint.has(mint) };
}
