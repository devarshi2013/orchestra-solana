/**
 * Sample assistant replies for the Markdown renderer: used by the tests and
 * by the dev-only preview page (/dev/chat-preview). The numbers are made up
 * and never shown to users.
 */

const threeStockTable = [
  "| Company | Ticker | Price | Market cap | 1Y return | P/E |",
  "|---|---|---:|---:|---:|---:|",
  "| NVIDIA | NVDA | $182.45 | $4.43T | +38.2% | 52.1 |",
  "| Apple | AAPL | $231.10 | $3.43T | +12.3% | 34.8 |",
  "| Microsoft | MSFT | $509.77 | $3.79T | +21.0% | 37.5 |",
].join("\n");

export const FIXTURES = {
  threeStocks: [
    "Here are the three largest US tech companies by market cap:",
    "",
    threeStockTable,
    "",
    "- **NVDA** had the best 1-year return.",
    "- **AAPL** is the cheapest on P/E.",
  ].join("\n"),

  negatives: [
    "Energy had a rough year:",
    "",
    "| Company | Ticker | Market cap | 1M return | 1Y return |",
    "|---|---|---:|---:|---:|",
    "| Exxon Mobil | XOM | $45.6B | -3.4% | -12.9% |",
    "| Chevron | CVX | $268.2B | +1.1% | −4.0% |",
    "| ConocoPhillips | COP | $118.0B | 0.0% | -21.5% |",
  ].join("\n"),

  longTable: [
    "| Company | Ticker | Price | Market cap | 1Y return | P/E | Revenue growth | Liquidity |",
    "|---|---|---:|---:|---:|---:|---:|---|",
    "| Alphabet Inc. Class A | GOOGL | $245.12 | $2.97T | +31.4% | 26.0 | +13.9% | high |",
    "| Meta Platforms | META | $712.40 | $1.79T | +27.7% | 27.2 | +21.9% | high |",
    "| Netflix | NFLX | $1,201.33 | $511.0B | +71.2% | 51.3 | +15.6% | medium |",
    "| Walt Disney | DIS | $111.80 | $201.2B | -2.6% | 18.1 | +4.9% | medium |",
  ].join("\n"),

  mixed: [
    "## How they're listed",
    "",
    "I searched **Technology** with `minLiquidity: medium`.",
    "",
    "| Ticker | Issuer token | Liquidity |",
    "|---|---|---|",
    "| NVDA | NVDAx | high |",
    "| AMD | AMDx | medium |",
    "",
    "### Things to keep in mind",
    "",
    "1. Both are semiconductor stocks, so they move together.",
    "2. Quotes outside US market hours can be wider.",
    "",
    "> Tokenized stocks aren't available to US persons.",
    "",
    "More on the issuers: [xStocks](https://xstocks.com).",
    "",
    "This is research, not financial advice.",
  ].join("\n"),

  /** Text from two model calls (before and after a tool call), as separate blocks. */
  splitBlocks: [
    "I'll look up those three stocks.",
    "Here's how they compare:\n" + threeStockTable + "\n\nNVDA leads on return.",
  ],

  comparison: [
    "Here are three large tech stocks, ranked by market cap:",
    "",
    "```comparison",
    JSON.stringify(
      {
        title: "Largest US tech companies by market cap",
        rows: [
          { company: "NVIDIA", ticker: "NVDA", marketCap: 4.43e12, return1y: 38.2, pe: 52.1 },
          { company: "Apple", ticker: "AAPL", marketCap: 3.43e12, return1y: -4.1, pe: 34.8 },
          { company: "Microsoft", ticker: "MSFT", marketCap: 3.79e12, return1y: 21, pe: null },
        ],
      },
      null,
      2,
    ),
    "```",
    "",
    "- **NVDA** returned the most over the year.",
  ].join("\n"),
} as const;

/** `text` cut into `count` chunks, as a stream would deliver it. */
export function chunk(text: string, count: number): string[] {
  const size = Math.ceil(text.length / count);
  return Array.from({ length: count }, (_, i) => text.slice(i * size, (i + 1) * size));
}
