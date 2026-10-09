# Stock tools

`src/lib/assets/tools.ts` holds server-side functions, e.g. for an assistant's
tool list (`ASSET_TOOLS`). Each one validates its input with Zod and returns
`{ data, reason }`: the data, or `null` and why.

- **Assets are named by ticker or token symbol and resolved only through the
  registry** ([assets.md](./assets.md)). No tool accepts a mint address, so
  nothing outside the registry can be looked up or quoted. A ticker shared by
  two issuers (`AAPL` → AAPLx and AAPLon) is refused as ambiguous for quotes;
  the token symbol must be used.
- **Numbers are never estimated.** Any missing figure is `null`, and the
  per-asset `missing` map says why (e.g. `"Not applicable to an ETF or fund"`,
  or the provider's error).
- **Market data is cached for 15 minutes** (`src/server/cache.ts`; failures are
  not cached). Swap quotes and wallet balances are always live.

| Tool                                           | Returns                                                                                                                                                                                   | Sources                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `listAssets({ sector? })`                      | The registry's tokenized stocks (ticker, symbol, name, sector, issuer, hours)                                                                                                             | Registry                                |
| `getStockMetrics(tickers[])`                   | Per company: market cap, P/E (TTM), latest annual revenue growth %, 1M/6M/1Y returns %, ETF flag, which tokens represent it                                                               | Financial Modeling Prep                 |
| `getSwapQuote({ ticker, usdcAmount, wallet })` | Tokens out, minimum out, price impact %, fee bps, network fees (SOL), router, gasless, a warning if the wallet can't make the trade. `executed: false`; the transaction is never returned | Jupiter `/order` (with `taker`) and RPC |
| `getWalletBalances(wallet)`                    | Native SOL and USDC                                                                                                                                                                       | Solana RPC                              |

## Stock data: Financial Modeling Prep

Set `MARKET_DATA_API_KEY`. Without it, `getStockMetrics` returns a reason
saying the key is needed. We chose FMP because one provider covers every
requested figure for the **real company** (the underlying ticker, e.g. NVDA
for both NVDAx and NVDAon) in four cached calls:

| Figure                    | Endpoint (`https://financialmodelingprep.com/stable/…`) | Field                                                                      |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| Market cap, ETF/fund flag | `profile?symbol=`                                       | `marketCap`, `isEtf`, `isFund`                                             |
| 1M / 6M / 1Y returns      | `stock-price-change?symbol=`                            | `1M`, `6M`, `1Y` (percent)                                                 |
| P/E (TTM)                 | `ratios-ttm?symbol=`                                    | `priceToEarningsRatioTTM` (older APIs: `peRatioTTM`)                       |
| Revenue growth            | `financial-growth?symbol=&period=annual&limit=1`        | `revenueGrowth`, a fraction we convert to percent (older: `growthRevenue`) |

With Polygon (now Massive), P/E and returns would have to be computed from raw
financials and price bars ourselves.

- **ETFs and funds:** P/E and revenue growth are reported as not applicable.
- **Negative earnings:** P/E is null ("not meaningful").

**Still to confirm with a real key:**

- **Field names:** FMP's documentation is script-rendered and wasn't readable
  here. The endpoints and the price-change keys are confirmed; the P/E and
  growth names come from FMP's naming, and we accept either spelling. If FMP
  returns neither, the figure is null with the reason "returned no P/E".
- **Rate limits:** the free plan has a daily request cap, so check your plan.
  Caching helps: about 4 requests per company every 15 minutes.

## Swap quotes

`getSwapQuote` calls Jupiter `/order` with the wallet as `taker`, so fees,
gasless routing and balance checks are real. It never signs, sends, or
returns the transaction.

- **Quotes Jupiter can't build** (e.g. not enough USDC): Jupiter's reason
  becomes `warning`.
- **RFQ (JupiterZ) quotes don't check the wallet's balance** (seen live with
  NVDAx), so the tool also reads the wallet's USDC and warns when it's short.
- **`thinLiquidity`:** price impact above the `/assets` threshold (1%).

## Tests

- `src/lib/assets/tools.test.ts`: every tool with mocked registry, FMP,
  Jupiter and RPC. Covers successful lookups and every null-with-reason case.
- `src/server/market/fmp.test.ts`: request URLs, keys, and error and 404
  handling.
