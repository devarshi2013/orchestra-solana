// Builds src/lib/stocks/registry.generated.json: every tokenized company stock
// and ETF that can be bought through Jupiter on Solana.
//
//   pnpm sync:stocks             full sync: test-quotes every verified token (~30 min
//                                at Jupiter's free 1 request/second)
//   pnpm sync:stocks --refresh   build-time refresh (runs before `pnpm build`): re-reads
//                                the official lists, re-verifies every mint, and re-quotes
//                                only the stocks already listed (~5 min)
//
// 1. Pulls each issuer's OFFICIAL list (the only way a mint can enter):
//    xStocks API, Ondo's token CSV, PreStocks' products page.
// 2. Verifies every mint with Jupiter's Tokens API (verified, same symbol, not
//    flagged, some liquidity or trading).
// 3. Runs a 100 USDC → token test quote to confirm a route; the price impact
//    sets the liquidity tier. RFQ market makers come and go with US market
//    hours, so in refresh mode a listed stock whose quote fails keeps its tier;
//    only leaving the official list or failing verification removes it.
// 4. Fills sector and industry from the market-data API (Financial Modeling
//    Prep with MARKET_DATA_API_KEY, else Nasdaq's public screener), the
//    issuer's own data, or (ETFs) the fund name.
// Anything that fails is excluded with its reason (src/lib/stocks/sync-report.json).
//
// It never breaks a build: if a source or Jupiter is unreachable, that
// issuer's previous entries are kept. SYNC_STOCKS=skip skips it entirely.
// Runs with Node's type stripping: `node --experimental-strip-types`.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";

import {
  classify,
  etfClassification,
  fromFmp,
  fromIssuer,
  fromNasdaq,
  liquidityTier,
  ondoSources,
  parseCsv,
  prestocksSources,
  TEST_QUOTE_USDC,
  verifySources,
  withOverride,
  xstocksSources,
  type Classification,
  type Exclusion,
  type JupiterTokenInfo,
  type SourceEntry,
  type XStocksNode,
} from "../src/lib/stocks/sync-core.ts";
import { usMarketSession } from "../src/lib/assistant/market-hours.ts";
import type { Issuer, RegistryFile, StockEntry } from "../src/lib/stocks/types.ts";

const SOURCES: Record<Issuer, string> = {
  xstocks: "https://api.xstocks.fi/api/v2/public/assets",
  ondo: "https://www.dropbox.com/scl/fi/qjfxyg748mx0dwi6up86d/EXTERNAL-Ondo-GM-Tokens-Ondo-GM-Tokens.csv?rlkey=n3no1w78wrah3umsl0nr9s77i&dl=1",
  prestocks: "https://prestocks.com/products",
};
const OUT = new URL("../src/lib/stocks/registry.generated.json", import.meta.url);
const REPORT = new URL("../src/lib/stocks/sync-report.json", import.meta.url);
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
/** Jupiter's free plan allows 1 request per second. */
const JUPITER_GAP_MS = 1100;
const MAX_QUOTES = Number(process.env.SYNC_STOCKS_MAX_QUOTES ?? 5000);
const REFRESH = process.argv.includes("--refresh");

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) loadEnvFile(file);
}
const clean = (v: string | undefined) =>
  v
    ?.trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .trim() || undefined;
const JUPITER_KEY = clean(process.env.JUPITER_API_KEY);
const JUPITER_BASE = (clean(process.env.JUPITER_API_BASE_URL) ?? "https://api.jup.ag").replace(
  /\/+$/,
  "",
);
const FMP_KEY = clean(process.env.MARKET_DATA_API_KEY);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args: unknown[]) => console.log("[sync-stocks]", ...args);

function previous(): RegistryFile | null {
  try {
    return JSON.parse(readFileSync(OUT, "utf8")) as RegistryFile;
  } catch {
    return null;
  }
}

let lastJupiterCall = 0;
/** A paced Jupiter GET with retries on rate limits and transient errors. */
async function jupiter(path: string, query: Record<string, string>): Promise<unknown> {
  const url = `${JUPITER_BASE}/${path}?${new URLSearchParams(query)}`;
  for (let attempt = 1; ; attempt++) {
    const wait = lastJupiterCall + JUPITER_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastJupiterCall = Date.now();
    const response = await fetch(url, {
      headers: { "x-api-key": JUPITER_KEY!, accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    }).catch((error: unknown) => error as Error);
    if (response instanceof Response && response.ok) return response.json();
    const status = response instanceof Response ? response.status : 0;
    const body =
      response instanceof Response ? await response.text().catch(() => "") : String(response);
    if ((status === 429 || status >= 500 || status === 0) && attempt < 4) {
      await sleep(2000 * attempt);
      continue;
    }
    throw new Error(`Jupiter ${path} ${status}: ${body.slice(0, 200)}`);
  }
}

async function fetchOk(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${new URL(url).host} ${response.status}`);
  return response;
}

async function loadOndo(): Promise<SourceEntry[]> {
  return ondoSources(parseCsv(await (await fetchOk(SOURCES.ondo)).text()));
}

async function loadXStocks(ondoTypes: Map<string, "stock" | "etf">): Promise<SourceEntry[]> {
  const nodes: XStocksNode[] = [];
  for (let page = 0; page < 50; page++) {
    const body = (await (await fetchOk(`${SOURCES.xstocks}?page=${page}&pageSize=100`)).json()) as {
      nodes: XStocksNode[];
      page?: { hasNextPage?: boolean };
    };
    nodes.push(...body.nodes);
    if (!body.page?.hasNextPage) break;
  }
  return xstocksSources(nodes, ondoTypes);
}

async function loadPreStocks() {
  const html = await (
    await fetchOk(SOURCES.prestocks, {
      headers: { "user-agent": "Mozilla/5.0 (Quill stock sync)" },
    })
  ).text();
  return prestocksSources(html);
}

/** Nasdaq's public stock screener: sector and industry for every US listing (one request, no key). */
async function nasdaqSectors(): Promise<Map<string, { sector: string; industry: string }>> {
  const response = await fetchOk(
    "https://api.nasdaq.com/api/screener/stocks?tableonly=true&download=true",
    {
      headers: { "user-agent": "Mozilla/5.0 (Quill stock sync)", accept: "application/json" },
    },
  );
  const body = (await response.json()) as {
    data: { rows: { symbol: string; sector: string; industry: string }[] };
  };
  return new Map(body.data.rows.map((r) => [r.symbol.toUpperCase(), r]));
}

/** Financial Modeling Prep profile (sector, industry), when MARKET_DATA_API_KEY is set. */
async function fmpProfile(ticker: string): Promise<{ sector?: string; industry?: string } | null> {
  const url = `https://financialmodelingprep.com/stable/profile?${new URLSearchParams({ symbol: ticker, apikey: FMP_KEY! })}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json().catch(() => null)) as
    { sector?: string; industry?: string }[] | null;
  return body?.[0] ?? null;
}

async function main() {
  if (process.env.SYNC_STOCKS === "skip")
    return log("SYNC_STOCKS=skip: keeping the existing registry.");
  const prior = previous();
  if (!JUPITER_KEY) {
    return log("JUPITER_API_KEY isn't set: can't verify mints, keeping the existing registry.");
  }

  // 1. Official sources. An issuer that can't be reached keeps its previous entries.
  const excluded: Exclusion[] = [];
  const kept: StockEntry[] = [];
  const keepPrevious = (issuer: Issuer, error: unknown) => {
    const old = prior?.stocks.filter((s) => s.issuer === issuer) ?? [];
    log(
      `⚠ ${issuer} source unavailable (${String(error)}); keeping its ${old.length} previous entries.`,
    );
    kept.push(...old);
  };
  let ondo: SourceEntry[] = [];
  let xstocks: SourceEntry[] = [];
  let prestocks: SourceEntry[] = [];
  try {
    ondo = await loadOndo();
  } catch (error) {
    keepPrevious("ondo", error);
  }
  try {
    xstocks = await loadXStocks(new Map(ondo.map((s) => [s.ticker, s.type])));
  } catch (error) {
    keepPrevious("xstocks", error);
  }
  try {
    const result = await loadPreStocks();
    prestocks = result.sources;
    excluded.push(...result.excluded);
  } catch (error) {
    keepPrevious("prestocks", error);
  }
  const sources = [...xstocks, ...ondo, ...prestocks];
  log(
    `Official lists: ${xstocks.length} xStocks, ${ondo.length} Ondo, ${prestocks.length} PreStocks (Solana).`,
  );

  // 2. Verify with Jupiter's Tokens API, 100 mints per request.
  const tokens = new Map<string, JupiterTokenInfo>();
  try {
    for (let i = 0; i < sources.length; i += 100) {
      const batch = sources.slice(i, i + 100).map((s) => s.mint);
      const found = (await jupiter("tokens/v2/search", {
        query: batch.join(","),
      })) as JupiterTokenInfo[];
      for (const token of found) tokens.set(token.id, token);
    }
  } catch (error) {
    log(`⚠ Jupiter Tokens API unavailable (${String(error)}); keeping the existing registry.`);
    return;
  }
  const verification = verifySources(sources, tokens);
  const verified = verification.verified;
  excluded.push(...verification.excluded);
  log(`Verified on Jupiter: ${verified.length} of ${sources.length}.`);

  // 3. Test quote: 100 USDC → token, no wallet (quote only).
  const listedBefore = new Map((prior?.stocks ?? []).map((s) => [s.mint, s]));
  const toQuote =
    REFRESH && prior?.stocks.length
      ? verified.filter((v) => listedBefore.has(v.source.mint))
      : verified;
  if (toQuote.length < verified.length) {
    log(
      `Refresh: re-quoting the ${toQuote.length} listed stocks; ${verified.length - toQuote.length} other verified tokens need a full sync (pnpm sync:stocks).`,
    );
  }
  if (!usMarketSession(new Date()).open) {
    // Many xStocks trade only through RFQ market makers, who quote during US market hours.
    log(
      "⚠ US markets are closed: RFQ-only tokens (most xStocks) won't quote now and will be excluded. Run the full sync during US market hours (9:30–16:00 ET) for full coverage.",
    );
  }
  log(
    `Test-quoting ${toQuote.length} tokens (≈${Math.ceil((toQuote.length * JUPITER_GAP_MS) / 60000)} min)…`,
  );
  const quoted: { source: SourceEntry; token: JupiterTokenInfo; impact: number }[] = [];
  for (const [i, { source, token }] of toQuote.entries()) {
    const before = listedBefore.get(source.mint);
    const exclude = (reason: string) => {
      if (REFRESH && before) {
        // A transient RFQ gap: keep the listed stock with its last measured impact.
        quoted.push({ source, token, impact: before.testImpactPct });
        return;
      }
      excluded.push({ issuer: source.issuer, symbol: source.symbol, mint: source.mint, reason });
    };
    if (i >= MAX_QUOTES) {
      exclude(`Not test-quoted (over SYNC_STOCKS_MAX_QUOTES=${MAX_QUOTES})`);
      continue;
    }
    try {
      const order = (await jupiter("swap/v2/order", {
        inputMint: USDC_MINT,
        outputMint: source.mint,
        amount: String(TEST_QUOTE_USDC * 1_000_000),
      })) as {
        outAmount?: string;
        priceImpact?: number | null;
        error?: string;
        errorMessage?: string;
      };
      if (!order.outAmount || order.outAmount === "0") {
        exclude(
          `No route for a ${TEST_QUOTE_USDC} USDC test quote${order.errorMessage ? `: ${order.errorMessage}` : ""}`,
        );
        continue;
      }
      const impact = Math.abs(order.priceImpact ?? 0);
      if (liquidityTier(impact) === null) {
        exclude(`Price impact ${impact.toFixed(2)}% on a ${TEST_QUOTE_USDC} USDC test quote`);
        continue;
      }
      quoted.push({ source, token, impact });
    } catch (error) {
      exclude(`Test quote failed: ${String(error).slice(0, 160)}`);
    }
    if ((i + 1) % 50 === 0) log(`  …${i + 1}/${toQuote.length} quoted`);
  }

  // 4. Sectors and industries.
  const tickers = [
    ...new Set(
      quoted
        .filter((q) => q.source.type === "stock" && !q.source.preIpo)
        .map((q) => q.source.ticker),
    ),
  ];
  const fmp = new Map<string, Classification | null>();
  if (FMP_KEY) {
    for (const ticker of tickers) {
      const profile = await fmpProfile(ticker);
      fmp.set(ticker, withOverride(ticker, fromFmp(profile?.sector, profile?.industry)));
      await sleep(250);
    }
  }
  let nasdaq = new Map<string, { sector: string; industry: string }>();
  try {
    nasdaq = await nasdaqSectors();
  } catch (error) {
    log(`⚠ Nasdaq screener unavailable (${String(error)}); sectors fall back to issuer data.`);
  }

  const stocks: StockEntry[] = quoted.map(({ source, token, impact }) => {
    // Nasdaq writes class shares as BRK/B; the issuers use BRK.B.
    const n = nasdaq.get(source.ticker) ?? nasdaq.get(source.ticker.replace(".", "/"));
    const c =
      source.type === "etf"
        ? classify(fromIssuer(source.issuerSector), etfClassification(source.companyName))
        : classify(
            fmp.get(source.ticker) ?? null,
            source.preIpo
              ? null
              : fromNasdaq(source.ticker, n?.sector ?? null, n?.industry ?? null),
            fromIssuer(source.issuerSector),
          );
    return {
      ticker: source.ticker,
      companyName: source.companyName,
      type: source.type,
      sector: c.sector,
      industry: c.industry,
      mint: source.mint,
      issuer: source.issuer,
      liquidityTier: liquidityTier(impact)!,
      symbol: token.symbol,
      decimals: token.decimals,
      hours: source.hours,
      preIpo: source.preIpo,
      sectorSource: c.source,
      testImpactPct: Number(impact.toFixed(4)),
    };
  });
  const all = [...stocks, ...kept].sort(
    (a, b) =>
      a.sector.localeCompare(b.sector) ||
      a.ticker.localeCompare(b.ticker) ||
      a.issuer.localeCompare(b.issuer),
  );

  const file: RegistryFile = {
    syncedAt: new Date().toISOString(),
    testQuoteUsdc: TEST_QUOTE_USDC,
    sources: SOURCES,
    stocks: all,
  };
  // One entry per line keeps diffs readable.
  writeFileSync(
    OUT,
    `{\n  "syncedAt": ${JSON.stringify(file.syncedAt)},\n  "testQuoteUsdc": ${file.testQuoteUsdc},\n  "sources": ${JSON.stringify(file.sources)},\n  "stocks": [\n${all.map((s) => `    ${JSON.stringify(s)}`).join(",\n")}\n  ]\n}\n`,
  );
  const count = (key: (s: StockEntry) => string) =>
    Object.fromEntries(
      Object.entries(
        all.reduce<Record<string, number>>(
          (acc, s) => ((acc[key(s)] = (acc[key(s)] ?? 0) + 1), acc),
          {},
        ),
      ).sort(([, a], [, b]) => b - a),
    );
  const summary = {
    tokens: all.length,
    companies: new Set(all.map((s) => s.ticker)).size,
    bySector: count((s) => s.sector),
    byIssuer: count((s) => s.issuer),
    byTier: count((s) => s.liquidityTier),
    byType: count((s) => s.type),
    sectorSource: count((s) => s.sectorSource),
  };
  writeFileSync(
    REPORT,
    `${JSON.stringify({ syncedAt: file.syncedAt, summary, excludedCount: excluded.length, excluded }, null, 1)}\n`,
  );
  log("Done.", JSON.stringify(summary, null, 2));
  log(`Excluded ${excluded.length} (reasons in src/lib/stocks/sync-report.json).`);
}

main().catch((error: unknown) => {
  // Never fail a build over the sync: the previous registry stays in place.
  log("⚠ Sync failed; keeping the existing registry.", error);
});
