# Market data

Jupiter has no price history: Price API v3 returns the spot price only (see
[jupiter-api.md](./jupiter-api.md) §0 #4). Indicators and backtests need daily
history, so Orchestra stores OHLC candles from a historical provider in
Postgres.

## Sources

[`priceSource()`](../src/lib/market/sources.ts) picks the source on each run:
**Birdeye** when `BIRDEYE_API_KEY` is set, otherwise **GeckoTerminal**, which
needs no key.

|                     | GeckoTerminal (default)                                       | Birdeye (optional)                                              |
| ------------------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Account / key       | None                                                          | `BIRDEYE_API_KEY` from [bds.birdeye.so](https://bds.birdeye.so) |
| Prices from         | **One pool** per token (see below), USD                       | All of the token's markets combined, USD                        |
| History reachable   | **Last 180 days** (older requests get a 401)                  | Full history                                                    |
| Candles per request | 1,000                                                         | 5,000                                                           |
| Rate limit          | Per IP, unpublished; failed requests count. We pace 1 per 6 s | 1 request/second; 30,000 CU/month free                          |
| Volume              | USD only (`volume` stays null)                                | Token units and USD                                             |

Both skip periods with no trades instead of returning empty candles.

We didn't use CoinGecko's coin API: it looks tokens up by CoinGecko coin id,
not by mint, so long-tail tokens are often missing. Its free plan also returns
4-day candles for any range beyond 30 days.

### GeckoTerminal

[`src/server/geckoterminal/client.ts`](../src/server/geckoterminal/client.ts),
base URL `https://api.geckoterminal.com/api/v2/networks/solana`.

- **Pool:** `GET /tokens/{mint}/pools` (first page), then `pickPricePool`:
  the highest **24h USD volume** among pools created more than 180 days ago,
  so their history fills the whole window. When every pool is newer (a new
  token), all pools are considered. The choice is saved in
  `tracked_mints.price_pool` and reused, so a token's series never switches
  pools.
  - **Why volume, not `reserve_in_usd`:** spoofed pools report billions in
    reserves while barely trading. At the time of writing, an "APT / USDC" pool
    claimed $8.1B in reserves on $260k of daily volume. Pricing from such a
    pool would feed a strategy fake numbers.
- **Candles:** `GET /pools/{pool}/ohlcv/{day|hour}?aggregate=1&currency=usd&token={mint}&before_timestamp=…&limit≤1000`.
  `token={mint}` prices the token itself rather than the pool's base token.
  Rows are `[time, o, h, l, c, volumeUsd]`, newest first.
- **The per-token OHLCV endpoint** (`/tokens/{mint}/ohlcv`) needs a CoinGecko
  key, so we use the pool endpoint.
- **Rate limit:** one request per 6 seconds. On a 429 the client waits 10 s,
  then 20 s, then 40 s before giving up on that mint for this run.
- **Backfill:** 179 days of `1D` (one day inside the limit) and 41 days of
  `1H`, which is one 1,000-candle request. The strategies only read daily
  candles.

### Birdeye

[`src/server/birdeye/client.ts`](../src/server/birdeye/client.ts),
`GET https://public-api.birdeye.so/defi/v3/ohlcv`
([docs](https://data.birdeye.so/docs/data-api/price-ohlcv/get-defi-v3-ohlcv.md)).

- **Request:** headers `X-API-KEY` and `x-chain: solana`. Query `address`,
  `type` (`1D` | `1H`), `currency=usd`, `time_from` and `time_to` (Unix
  seconds, inclusive).
- **Response:** `{ success, data: { items: [{ o, h, l, c, v, v_usd, unix_time }] } }`.
- **Cost:** 25 CU for up to 100 candles, 40 up to 1,000, 75 up to 2,000 and
  100 up to 5,000. Requests are spaced 1.1 s apart.
- **Backfill:** 3 years of `1D` and 90 days of `1H`.

### Switching sources

The job only appends after the latest stored candle. Adding a Birdeye key later
therefore continues each series from Birdeye, but it does **not** backfill
history older than what GeckoTerminal already stored. To get Birdeye's full
history, clear the stored data and rerun the job:
`TRUNCATE candles, tracked_mints;`.

## Storage

Two tables, defined in [`prisma/schema.prisma`](../prisma/schema.prisma):

- `candles`: primary key `(mint, interval, open_time)`; `interval` is `D1` or
  `H1`. Prices are USD doubles. **Only closed candles are stored**, so a row
  never changes once written and inserts can skip duplicates.
- `tracked_mints`: the mints the sync job maintains. Each row also has the
  GeckoTerminal pool used for that mint, the last sync time and the last
  error.

Daily candles open at 00:00 UTC. `toMarketData`
([`src/lib/market/candles.ts`](../src/lib/market/candles.ts)) lays them on a
gap-free UTC date axis, which is the input `evaluate()` reads:

- Before a mint's first candle, its value is `null` (not listed yet).
- On a later day with no candle, the previous close carries forward: no trades
  means the price didn't move. Without this, a single quiet day would cut an
  illiquid token's history short.

## Sync job: `GET /api/cron/prices`

[`src/app/api/cron/prices/route.ts`](../src/app/api/cron/prices/route.ts) runs
[`syncPrices`](../src/lib/market/sync.ts). For each tracked mint, least
recently synced first:

1. **Backfill** when nothing is stored yet, as far back as the source allows. A
   token listed more recently returns whatever history exists.
2. **Append**: every closed candle after the latest stored one. When the mint
   is already up to date, no request is made.

The job is idempotent, so rerunning it is safe. One failing mint is recorded in
`tracked_mints.last_error` and the job moves on to the next. After 4 minutes it
stops starting new mints and returns them under `deferred`; the next run takes
them first. The response looks like
`{ source, synced: [{ mint, inserted, error? }], deferred }`.

- **Auth:** `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this
  automatically. Without `CRON_SECRET`, the route is open in development and
  rejects every request in production.
- **Which mints:** the mints the example symphonies use are always tracked.
  Add more with `?track=<mint>,<mint>` (up to 50 per call).
- **Schedule:** [`vercel.json`](../vercel.json) runs the job daily at 00:10
  UTC, just after the daily candle closes.
  - GeckoTerminal: 2 requests per mint per day, about 12 s.
  - Birdeye: about 50 CU per mint per day, so the free 30k CU/month covers
    about 15 mints.
- **Timing (measured, GeckoTerminal, 7 default mints):**
  - First backfill: about 4 minutes, at 3 requests per mint plus pacing.
  - Daily runs: about 1.5 minutes.
  - On a platform with a shorter function limit (for example Vercel Hobby, 60
    s), the backfill spreads across several runs through `deferred`.
- **Running it locally:** `curl localhost:3000/api/cron/prices`.

## Short histories

Every indicator in [`src/lib/indicators/`](../src/lib/indicators) is a pure
function that returns `null` when the series is too short (`barsRequired`).
`evaluateWithWarnings` never fails on missing history. Instead it falls back as
follows and returns an `EvaluationWarning` for each fallback:

| Node               | Fallback                                                  |
| ------------------ | --------------------------------------------------------- |
| `if`               | Takes the **else** branch                                 |
| `filter`           | Ranks the child **last**; it's still picked if N needs it |
| inverse-volatility | Weights the group's children **equally**                  |

`describeWarning` turns a warning into one sentence, which `/symphonies` shows
above each allocation.

On GeckoTerminal, a token has at most 180 days of history at first, and the
stored history grows by a day with each run. Indicators that need more than
that (for example SMA(200)) fall back with a warning until enough days are
stored.
