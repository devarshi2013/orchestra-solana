# Markets and trading pages

## /markets: the stocks screener

`src/app/markets/page.tsx` renders `Screener` (`src/components/markets/screener.tsx`):

- **Search** ("Search stocks…", `/` focuses it) over ticker, company name and token symbol.
- **Tabs:** All, Equities, ETFs, Commodities (ETFs whose name mentions gold, silver, oil, gas, copper, platinum or palladium).
- **Top performers:** the four biggest 24h gainers (`top-performers.tsx`).
- **Table:** Company (logo, name, ticker), Price, 24h %, Last 24h (SVG sparkline, `sparkline.tsx`), Market cap, 24h volume. Every header sorts; a row opens the stock's page. On phones Market cap and Volume are hidden and the table scrolls sideways. Skeleton rows show while loading.
- **Live prices:** the rows on screen (IntersectionObserver) are polled every 12 s in one batched request, only while the tab is visible; a changed price glides to its new value and flashes green or red (`live-number.tsx`).

### Look: the same as the home page

The page is dressed from the same sources as the home page, so the two can't
drift apart:

- **Tokens** (`src/app/globals.css`): page, surface, border, text, accent
  (`--glow-blue`, `--label-blue`, `--silver`), gain and loss. Home components
  use these tokens rather than repeating hex values, and the chart reads its
  canvas colours from them.
- **Shared components** (`src/components/design/`): `GradientCard` (the
  table and the top-performer cards), `Accent` (the italic word in the title),
  `Orbs` and `GridOverlay` (behind the heading).
- **Spacing:** `section-head` and `--section-gap`, as on the home page.

Table details: header labels are small tracked-out uppercase and stick under
the navbar from tablets up (with a blur); sortable headers get an underline
that slides in, and the active sort arrow is accent blue. Rows tint on hover,
light their left edge, brighten the name and thicken the sparkline; they fade
in with a light stagger on first load and when the tab or search changes.
24h change is a green or red pill with an arrow (`ChangePill`); a price flashes
green or red when it updates. Under reduced motion there is no stagger and no
flash. Clicking a row opens the stock's page, as before.

## /markets/[symbol]: one stock

Built ahead of time for every listed company (`generateStaticParams`); live data loads in the browser.

- **Header:** logo, name, ticker and token, live price, 24h change.
- **Chart** (`price-chart.tsx`): [lightweight-charts](https://github.com/tradingview/lightweight-charts) area chart with 1H / 1D / 1W / 1M / 1Y, a crosshair and a hover tooltip.
- **Stats:** on-chain market cap, 24h volume, holders, 24h high and low, liquidity.
- **Trade panel** (`trade-panel.tsx`, `src/hooks/use-trade.ts`): Buy / Sell tabs, an amount, the estimated amount received, Jupiter's fee and price impact, then "Review trade" → a summary → "Approve in wallet". The wallet signs (`signTransaction`, never sends) and `/api/swap/execute` lands it: Jupiter Swap v2 `/order` + `/execute` only, nothing custodial, nothing signed automatically. One short line notes when the US market is closed.
- **Ask Quill about TICKER** opens the chat with the question filled in (not sent).

## Data (`src/server/markets/screener.ts`)

The registry is the only source of tokens and mints; `/api/swap/order` accepts only USDC ↔ a registry token. API keys stay on the server.

| Route                                         | Source                                                                                                                  | Cached                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `GET /api/markets`                            | Jupiter Tokens v2 (`/search`, 100 mints a call, paced): logo, price, 24h change, market cap, volume, holders, liquidity | 60 s                      |
| `GET /api/markets/prices?tickers=` (≤ 40)     | Jupiter Price v3 (50 mints a call)                                                                                      | 10 s per mint             |
| `GET /api/markets/sparklines?tickers=` (≤ 40) | GeckoTerminal 24h candles                                                                                               | 10 min                    |
| `GET /api/markets/history?ticker=&window=`    | GeckoTerminal candles for the chart                                                                                     | per window (2 min to 6 h) |
| `GET /api/markets/balance?wallet=&mint=`      | Solana RPC: USDC and the token                                                                                          | no                        |

- **One token per company:** the most liquid issuer's token is the one traded. Charts use the xStocks token when there is one (it trades in AMM pools, so its history is complete).
- **Which price is shown:** the xStocks token's price when there is one, since Jupiter's price for RFQ-only tokens can drift or be wrong (MSFTon once read $704 against $534). Otherwise the traded token's price, unless the issuers disagree by more than 5%, in which case none. Trades always use a live Jupiter quote.
- **Market cap is on-chain** (tokens on Solana × price), not the company's market cap, and is labelled so.
- **Sparklines** come from GeckoTerminal, which allows about one request every two seconds. Pools are looked up 30 tokens a call, the largest stocks are warmed in the background, and the rest fill in as they load; a chart someone is waiting on goes ahead of that queue.
- **Errors** are the friendly one-liners from `src/lib/friendly-error.ts`; details are logged, never shown. Jupiter 429s are retried with backoff.
