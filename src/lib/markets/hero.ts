import type { MarketRow } from "./types";

/** One stock in the home hero's rotating chart. */
export type HeroStock = {
  ticker: string;
  name: string;
  /** The token charted and quoted, e.g. TSLAx. */
  symbol: string;
  icon: string | null;
  /** An example question about this stock for the hero's chat bubble. */
  question: string;
};

/** The hero's rotation list (GET /api/markets/hero). */
export type HeroStocks = {
  stocks: HeroStock[];
  /** What the list is ranked by: 24h volume, or market cap when Jupiter reports no volume. */
  basis: "volume" | "marketCap";
  /** True while some candidates' price history is still loading: ask again shortly. */
  pending: boolean;
  asOf: string;
};

export const HERO_COUNT = 8;

export type HeroCandidate = Pick<
  MarketRow,
  "ticker" | "category" | "preIpo" | "price" | "volume24h" | "marketCap"
> & { tier: "high" | "medium" | "low" };

/**
 * The stocks the hero may show, most in demand first: public-company stocks
 * with a price and high or medium liquidity, ranked by Jupiter's 24h on-chain
 * volume. When no stock reports a volume they're ranked by market cap instead.
 */
export function rankHeroCandidates<T extends HeroCandidate>(
  rows: readonly T[],
): { ranked: T[]; basis: HeroStocks["basis"] } {
  const eligible = rows.filter(
    (r) => r.category === "equity" && !r.preIpo && r.price !== null && r.tier !== "low",
  );
  const withVolume = eligible.filter((r) => (r.volume24h ?? 0) > 0);
  if (withVolume.length > 0) {
    return {
      ranked: withVolume.sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0)),
      basis: "volume",
    };
  }
  return {
    ranked: eligible
      .filter((r) => (r.marketCap ?? 0) > 0)
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)),
    basis: "marketCap",
  };
}

/** The name people say: "Alphabet Class A" → "Alphabet", "Amazon.com" → "Amazon". */
export const spokenName = (name: string) =>
  name
    .replace(/\s+Class\s+[A-Z]$/i, "")
    .replace(/\.com$/i, "")
    .replace(/,?\s+(Inc\.?|Corp\.?|Corporation|Holdings|Ltd\.?|plc)$/i, "")
    .trim();

const QUESTIONS: ((name: string) => string)[] = [
  (n) => `Should I buy ${n}?`,
  (n) => `How has ${n} done this year?`,
  (n) => `Is ${n} overvalued right now?`,
  (n) => `What moves ${n}'s price?`,
  (n) => `What are the risks with ${n}?`,
  (n) => `How does ${n} make money?`,
  (n) => `${n} or the S&P 500?`,
  (n) => `What's the bull case for ${n}?`,
];

/** An example question for the stock at `index` in the list (each stock gets a different one). */
export const heroQuestion = (name: string, index: number) =>
  QUESTIONS[index % QUESTIONS.length]!(spokenName(name));

/** A shuffled copy (Fisher–Yates); `random` is injectable for tests. */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
