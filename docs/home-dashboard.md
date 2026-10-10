# Home page market dashboard

The home page (`src/app/page.tsx`) is a live market dashboard for a few Solana
tokens and tokenized stocks, with **one** button into the chat.

## What's on it

- **Market list** (`src/components/market/market-grid.tsx`), at the top: a card
  per token with logo, price, 24h change and a 24h sparkline; tabs Crypto /
  Stocks / Top movers (largest absolute 24h change). It's the only way to pick
  a market: clicking a card (or Enter on it) shows it in the chart below, and the
  card gets a navy border. The first token is picked by default. On phones the
  cards are one swipeable row, and picking one scrolls the chart into view.
- **Chart** (`src/components/market/hero-chart.tsx`), below the list: the
  picked market's name ("NVDAx · NVIDIA"), big live price with the 24h change, a
  live/paused indicator, a [Liveline](https://github.com/benjitaylor/liveline)
  chart (line or candles; 1H / 24H / 7D / 30D, kept when switching markets), and
  stats: market cap, 24h volume, liquidity, holders. It fades in briefly when
  the market changes. For tokenized stocks the market cap is labelled
  "on-chain" (tokens on Solana × price), because it is not the company's market
  cap. The site is monochrome: the line is navy when the 24h move is up and gray
  when it's down, and changes always carry a ▲/▼ and a +/− sign, so colour is
  never the only cue. Liveline's own green/red (candles, momentum) is patched
  to navy and gray (`patches/liveline@0.0.7.patch`).
- **The call to action**: "Ask Quill", the page's only link to the chat.
  When a tokenized stock is on screen it reads "Ask Quill about NVDA" and
  opens `/chat?q=Tell me about NVDA`. The chat puts that in the input box
  (it's never sent automatically) and removes `?q=` from the URL. Crypto tokens
  open the chat without a question, since the assistant covers stocks only.

Tokens are listed in `src/lib/market/config.ts`. Stock mints are copied from
the verified registry, and `config.test.ts` fails if one ever differs (the
registry itself isn't imported, so it isn't shipped to the browser).

## Data sources

| Data                                             | Source                                                            | Route                                    | Cached                                          |
| ------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| Live price + 24h change                          | Jupiter Price API v3 (all tokens in one call)                     | `GET /api/market/prices`                 | 4 s on the server and at the CDN                |
| Logo, market cap, 24h volume, liquidity, holders | Jupiter Tokens API v2 (`tokens/v2/search`, all mints in one call) | `GET /api/market/tokens`                 | 60 s                                            |
| Price history (OHLC)                             | GeckoTerminal public API                                          | `GET /api/market/history?window=&mints=` | 2 min (1H) to 2 h (30D); CDN only when complete |

**Why GeckoTerminal for history.** Jupiter's developer APIs have no price
history: Price API v3 returns the current price only (checked against
developers.jup.ag on 2026-10-10). GeckoTerminal's public API needs no key and
returns USD candles per pool for any Solana token, including the xStocks. Birdeye
would need a key kept on the server; its signup page didn't load for us earlier,
and GeckoTerminal covers what the dashboard needs.

- Each token's pool is fixed in the config (the busiest pool by 24h volume that
  is at least 30 days old, chosen 2026-10-10). If it returns no data, the
  server looks up the current top pool (cached for a day).
- GeckoTerminal allows roughly 30 requests a minute per IP, fewer after bursts.
  The server spaces calls at least 2.2 s apart, backs off 15 s after a 429, and
  caches every window. `/api/market/history` answers within about 8 s:
  anything not loaded by then is returned as `pending` and the browser asks
  again a few seconds later (up to 6 times).
- History is one pool's price; for liquid tokens that's close to the market
  price, but it can differ slightly from Jupiter's live price.

## Polling

- **One request for every token.** `MarketProvider` (`src/hooks/use-market.tsx`)
  polls `/api/market/prices` every 8 s; every card and the hero read from it.
  Each answer is appended to the chart as a live tick.
- **Paused while the tab is hidden** (`visibilitychange`): no requests, the
  charts show Liveline's paused state and the indicator reads "Paused"; it
  fetches straight away when the tab is visible again.
- Sparkline history is one batched request for all tokens; the chart asks for
  its token and window when they change.

## No made-up data

Every point is a real candle close or a real polled price. While history
loads, charts show Liveline's loading state; if it fails, the chart shows the
live ticks collected since the page opened (with a note), or Liveline's empty
state with the reason. Missing stats show "Unavailable".
