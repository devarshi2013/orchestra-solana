/**
 * The pure parts of the stock sync (scripts/sync-stocks.ts): reading each
 * issuer's official list, deciding what Jupiter verification and test quotes
 * mean, and mapping sector data to the standard sectors. No I/O and no "@/"
 * imports, so Node can run it directly (type stripping) and tests can call it.
 */

import type { Issuer, LiquidityTier, Sector, SectorSource } from "./types.ts";

/** One token as an issuer's official list describes it (before any verification). */
export type SourceEntry = {
  issuer: Issuer;
  /** The token symbol the issuer publishes, e.g. NVDAx, NVDAon, OPENAI. */
  symbol: string;
  /** The company's ticker (or a name-based id for private companies). */
  ticker: string;
  companyName: string;
  type: "stock" | "etf";
  /** Sector text from the issuer, if any (e.g. Ondo "Technology - Software", PreStocks "AI"). */
  issuerSector: string | null;
  mint: string;
  hours: string;
  preIpo: boolean;
};

export type Exclusion = { issuer: Issuer; symbol: string; mint: string; reason: string };

// --- Official sources ---------------------------------------------------------

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines in quotes). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const endField = () => {
    row.push(field);
    field = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endField();
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    endField();
    rows.push(row);
  }
  const [header = [], ...body] = rows;
  return body
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])));
}

/** Ondo Global Markets' official token CSV → Solana stocks and ETFs (USDon and others excluded). */
export function ondoSources(rows: readonly Record<string, string>[]): SourceEntry[] {
  return rows
    .filter(
      (r) => (r["Solana Deployed Address"] ?? "").trim() && ["Stock", "ETF"].includes(r.Type ?? ""),
    )
    .map((r) => {
      const symbol = (r.Symbol ?? "").trim();
      return {
        issuer: "ondo" as const,
        symbol,
        ticker: ((r["Stock Ticker"] ?? "").trim() || symbol.replace(/on$/, "")).toUpperCase(),
        companyName: ((r["Stock Name"] ?? "").trim() || (r.Name ?? "").trim()).replace(
          / \(Ondo Tokenized\)$/,
          "",
        ),
        type: r.Type === "ETF" ? ("etf" as const) : ("stock" as const),
        issuerSector: (r["Sector / Taxonomy"] ?? "").trim() || null,
        mint: (r["Solana Deployed Address"] ?? "").trim(),
        hours: "24/5",
        preIpo: false,
      };
    });
}

export type XStocksNode = {
  symbol: string;
  name: string;
  underlyingSymbol?: string | null;
  deployments?: { network: string; address: string }[] | null;
  trading?: { tradingHoursMode?: string | null } | null;
  underlying?: { type?: string | null; exchange?: { mic?: string | null } | null } | null;
};

/**
 * xStocks' official API nodes → Solana tokens. xStocks publishes no asset
 * type: take it from Ondo's list for the same ticker, else an NYSE Arca
 * listing (an ETF venue), else the name.
 */
export function xstocksSources(
  nodes: readonly XStocksNode[],
  ondoTypes: ReadonlyMap<string, "stock" | "etf">,
): SourceEntry[] {
  const out: SourceEntry[] = [];
  for (const node of nodes) {
    const solana = (node.deployments ?? []).find((d) => d.network === "Solana");
    if (!solana) continue;
    const ticker = (node.underlyingSymbol ?? node.symbol.replace(/x$/, "")).toUpperCase();
    const name = node.name.replace(/ xStock$/, "");
    const mode = node.trading?.tradingHoursMode;
    out.push({
      issuer: "xstocks",
      symbol: node.symbol,
      ticker,
      companyName: name,
      type:
        ondoTypes.get(ticker) ??
        (node.underlying?.exchange?.mic === "ARCX" || /\bETF\b|\bFund\b|\bTrust\b/i.test(name)
          ? "etf"
          : "stock"),
      issuerSector: null,
      mint: solana.address,
      hours:
        mode === "TwentyFourFive"
          ? "24/5"
          : mode === "MarketHours" || mode === "Regular"
            ? "Market hours"
            : "Unknown",
      preIpo: false,
    });
  }
  return out;
}

/**
 * PreStocks' official products page embeds each product as JSON (`symbol`,
 * `name`, `industry`, `splMint`), and badges products that are no longer
 * pre-IPO ("Post-IPO", "Acquired"): those are excluded, since holders are
 * told to convert out before they expire.
 */
export function prestocksSources(html: string): { sources: SourceEntry[]; excluded: Exclusion[] } {
  const text = html.replace(/\\"/g, '"');
  const statusByName = new Map<string, string>();
  for (const m of text.matchAll(
    /font-semibold[^"]*">([^<]{1,60})<\/span><span class="rounded-full[^"]*">([^<]{1,30})<\/span>/g,
  )) {
    statusByName.set(m[1]!.trim(), m[2]!.trim());
  }
  const seen = new Set<string>();
  const sources: SourceEntry[] = [];
  const excluded: Exclusion[] = [];
  for (const m of text.matchAll(
    /\{"symbol":"([A-Z0-9.]+)","name":"([^"]+)".*?"splMint":"([1-9A-HJ-NP-Za-km-z]{32,44})"/g,
  )) {
    const [, symbol, name, mint] = m as unknown as [string, string, string, string];
    if (seen.has(mint)) continue;
    seen.add(mint);
    const block = m[0];
    const industry = /"industry":"([^"]*)"/.exec(block)?.[1] ?? null;
    const status = statusByName.get(name);
    if (status) {
      excluded.push({
        issuer: "prestocks",
        symbol,
        mint,
        reason: `No longer pre-IPO (${status}); PreStocks tells holders to convert out`,
      });
      continue;
    }
    sources.push({
      issuer: "prestocks",
      symbol,
      ticker: symbol,
      companyName: name,
      type: "stock",
      issuerSector: industry,
      mint,
      hours: "24/7",
      preIpo: true,
    });
  }
  return { sources, excluded };
}

// --- Jupiter verification -----------------------------------------------------

/** The fields of a Jupiter Tokens API v2 entry the sync uses. */
export type JupiterTokenInfo = {
  id: string;
  symbol: string;
  decimals: number;
  isVerified?: boolean | null;
  tags?: string[] | null;
  liquidity?: number | null;
  audit?: { isSus?: boolean | null } | null;
};

const norm = (s: string) => s.trim().replace(/^\$/, "").toUpperCase();

/**
 * Why a token from an official list can't be listed, or null when Jupiter
 * knows it, has verified it, publishes the same symbol, and hasn't flagged
 * it. Pool liquidity isn't required: many stock tokens trade only through
 * RFQ market makers, so the test quote decides whether a route exists.
 */
export function verificationFailure(
  source: SourceEntry,
  token: JupiterTokenInfo | undefined,
): string | null {
  if (!token) return "Not known to Jupiter";
  if (!token.isVerified) return "Not verified by Jupiter";
  if (norm(token.symbol) !== norm(source.symbol)) {
    return `Symbol mismatch: issuer says ${source.symbol}, Jupiter says ${token.symbol}`;
  }
  if (token.audit?.isSus) return "Flagged as suspicious by Jupiter";
  if (token.tags?.includes("backpack")) return "Backpack-issued (excluded)";
  return null;
}

/**
 * Splits the issuers' entries into those Jupiter verifies (known, verified,
 * same symbol, not suspicious, not Backpack) and exclusions with the reason.
 * `tokens` is Jupiter's Tokens API answer, by mint.
 */
export function verifySources(
  sources: readonly SourceEntry[],
  tokens: ReadonlyMap<string, JupiterTokenInfo>,
): { verified: { source: SourceEntry; token: JupiterTokenInfo }[]; excluded: Exclusion[] } {
  const verified: { source: SourceEntry; token: JupiterTokenInfo }[] = [];
  const excluded: Exclusion[] = [];
  for (const source of sources) {
    const token = tokens.get(source.mint);
    const reason = verificationFailure(source, token);
    if (reason || !token) {
      excluded.push({
        issuer: source.issuer,
        symbol: source.symbol,
        mint: source.mint,
        reason: reason ?? "Not known to Jupiter",
      });
    } else {
      verified.push({ source, token });
    }
  }
  return { verified, excluded };
}

// --- Test quotes and liquidity tiers --------------------------------------------

/** The sync's test quote: 100 USDC → token. */
export const TEST_QUOTE_USDC = 100;
/** Absolute price impact (%) on the test quote at or below which a token is "high" / "medium" liquidity. */
export const TIER_LIMITS = { high: 0.25, medium: 1 } as const;
/** Above this impact (%) on a 100 USDC buy a token isn't practically buyable, so it's excluded. */
export const MAX_TEST_IMPACT_PCT = 10;

/** `priceImpact` from Jupiter is in percent and usually ≤ 0. */
export function liquidityTier(priceImpactPct: number): LiquidityTier | null {
  const impact = Math.abs(priceImpactPct);
  if (!Number.isFinite(impact) || impact > MAX_TEST_IMPACT_PCT) return null;
  if (impact <= TIER_LIMITS.high) return "high";
  if (impact <= TIER_LIMITS.medium) return "medium";
  return "low";
}

// --- Sectors --------------------------------------------------------------------

export type Classification = { sector: Sector; industry: string | null; source: SectorSource };

/** Financial Modeling Prep's sector names → the standard sectors. */
const FMP_SECTORS: Record<string, Sector> = {
  technology: "Technology",
  "communication services": "Communication Services",
  "consumer cyclical": "Consumer Discretionary",
  "consumer defensive": "Consumer Staples",
  "financial services": "Financials",
  healthcare: "Health Care",
  industrials: "Industrials",
  energy: "Energy",
  "basic materials": "Materials",
  utilities: "Utilities",
  "real estate": "Real Estate",
};

export function fromFmp(sector: string | null | undefined, industry: string | null | undefined) {
  const mapped = sector ? FMP_SECTORS[sector.trim().toLowerCase()] : undefined;
  return mapped
    ? { sector: mapped, industry: industry?.trim() || null, source: "fmp" as const }
    : null;
}

/**
 * Companies a market-data provider files under a different sector than the
 * standard classification (Nasdaq lists Alphabet and Meta as Technology).
 */
const SECTOR_OVERRIDES: Record<string, Sector> = {
  GOOGL: "Communication Services",
  GOOG: "Communication Services",
  META: "Communication Services",
  NFLX: "Communication Services",
  DIS: "Communication Services",
  EA: "Communication Services",
  TTWO: "Communication Services",
  RBLX: "Communication Services",
  AMZN: "Consumer Discretionary",
  TSLA: "Consumer Discretionary",
  V: "Financials",
  MA: "Financials",
  PYPL: "Financials",
  COIN: "Financials",
  HOOD: "Financials",
};

/** Nasdaq stock screener sector names → the standard sectors. */
const NASDAQ_SECTORS: Record<string, Sector> = {
  technology: "Technology",
  telecommunications: "Communication Services",
  "consumer discretionary": "Consumer Discretionary",
  "consumer staples": "Consumer Staples",
  finance: "Financials",
  "health care": "Health Care",
  industrials: "Industrials",
  energy: "Energy",
  "basic materials": "Materials",
  utilities: "Utilities",
  "real estate": "Real Estate",
};

/** A Nasdaq screener row's sector and industry, for US listings when no market-data key is set. */
export function fromNasdaq(ticker: string, sector: string | null, industry: string | null) {
  const mapped =
    SECTOR_OVERRIDES[ticker] ?? (sector ? NASDAQ_SECTORS[sector.trim().toLowerCase()] : undefined);
  return mapped
    ? { sector: mapped, industry: industry?.trim() || null, source: "nasdaq" as const }
    : null;
}

/** Applies the standard-classification overrides to a provider's result. */
export function withOverride(ticker: string, c: Classification | null): Classification | null {
  const override = SECTOR_OVERRIDES[ticker];
  return c && override ? { ...c, sector: override } : c;
}

/** Issuer sector text: Ondo's "Technology - Software", PreStocks' "AI" / "Fintech" / "Defense". */
const ISSUER_SECTOR_WORDS: [RegExp, Sector][] = [
  [/^(ai|technology|software|semiconductor|robotics?|tech)\b/i, "Technology"],
  [/^(communications?|media|social|gaming|internet)\b/i, "Communication Services"],
  [/^consumer discretionary|^retail|^e-?commerce|^automotive/i, "Consumer Discretionary"],
  [/^consumer staples/i, "Consumer Staples"],
  [/^(fintech|financials?|crypto|banking|insurance|payments)\b/i, "Financials"],
  [/^(health|biotech|pharma|medical)/i, "Health Care"],
  [/^(industrials?|aerospace|defense|space|transportation)\b/i, "Industrials"],
  [/^energy\b/i, "Energy"],
  [/^materials?\b/i, "Materials"],
  [/^utilities\b/i, "Utilities"],
  [/^real estate\b/i, "Real Estate"],
];

export function fromIssuer(text: string | null) {
  if (!text) return null;
  const [head = "", ...rest] = text.split(" - ");
  const match = ISSUER_SECTOR_WORDS.find(([re]) => re.test(head.trim()));
  if (!match) return null;
  return {
    sector: match[1],
    industry: rest.join(" - ").trim() || head.trim(),
    source: "issuer" as const,
  };
}

/** ETFs carry no company sector: classify by what the fund's name says it holds. */
const ETF_WORDS: [RegExp, Sector, string][] = [
  [/semiconductor/i, "Technology", "Semiconductor ETF"],
  [/technology|\btech\b/i, "Technology", "Technology ETF"],
  [/energy|\boil\b|natural gas/i, "Energy", "Energy ETF"],
  [/financial|\bbank/i, "Financials", "Financials ETF"],
  [/health|biotech|pharma/i, "Health Care", "Health Care ETF"],
  [/real estate|\breit/i, "Real Estate", "Real Estate ETF"],
  [/utilit/i, "Utilities", "Utilities ETF"],
  [/gold|silver|metal|mining|materials/i, "Materials", "Precious metals and materials ETF"],
  [/industrial|aerospace|defen[cs]e/i, "Industrials", "Industrials ETF"],
  [/consumer staples/i, "Consumer Staples", "Consumer Staples ETF"],
  [/consumer discretionary/i, "Consumer Discretionary", "Consumer Discretionary ETF"],
  [/communication/i, "Communication Services", "Communication Services ETF"],
  [/treasury|bond|t-bill|income|fixed/i, "Diversified", "Bond ETF"],
  [/bitcoin|ether|crypto/i, "Diversified", "Crypto ETF"],
];

export function etfClassification(name: string) {
  const match = ETF_WORDS.find(([re]) => re.test(name));
  return match
    ? { sector: match[1], industry: match[2], source: "name" as const }
    : { sector: "Diversified" as const, industry: "Broad market ETF", source: "name" as const };
}

/** The first classification any source gave, in priority order; Unclassified when none did. */
export function classify(...candidates: (Classification | null)[]): Classification {
  return (
    candidates.find((c): c is Classification => c !== null) ?? {
      sector: "Unclassified",
      industry: null,
      source: "none",
    }
  );
}
