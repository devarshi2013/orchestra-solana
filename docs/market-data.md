# Market data

Jupiter has no price history: Price API v3 returns the spot price only (see
[jupiter-api.md](./jupiter-api.md) §0 #4). Indicators and backtests need daily
history, so Orchestra stores OHLC candles from a historical provider in
Postgres.

## Source: Birdeye Data Services

We use **Birdeye** `GET https://public-api.birdeye.so/defi/v3/ohlcv`
([docs](https://data.birdeye.so/docs/data-api/price-ohlcv/get-defi-v3-ohlcv.md)).

| Need                       | Birdeye                                          | CoinGecko (Demo/free)                                            |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Look up any Solana token   | By **mint address**, every token with DEX trades | By CoinGecko coin id; long-tail tokens often missing             |
| Daily and hourly candles   | `type=1D` / `1H`, true OHLCV                     | OHLC granularity is fixed by range: 4-day candles beyond 30 days |
| History depth on free plan | Full history                                     | Last 365 days                                                    |
| Free plan                  | Standard: 30,000 CU/month, 1 request/second      | 30 calls/minute, 10k calls/month                                 |

**Request:** headers `X-API-KEY: <BIRDEYE_API_KEY>` and `x-chain: solana`.
Query: `address`, `type` (`1D` | `1H`), `currency=usd`, `time_from`,
`time_to` (Unix seconds, inclusive). Up to **5,000 candles per request**.
Empty candles are not padded, so a period with no trades has no candle.

**Response:** `{ success, data: { items: [{ o, h, l, c, v, v_usd, unix_time, ... }] } }`.
`v` is volume in token units, `v_usd` in USD. Parsed by `ohlcvResponseSchema`
in [`src/server/birdeye/client.ts`](../src/server/birdeye/client.ts), which is
the only code that holds the key.

**Cost:** one request costs 25 CU for up to 100 candles, 40 CU up to 1,000,
75 CU up to 2,000 and 100 CU up to 5,000.

## Storage

Two tables, defined in [`prisma/schema.prisma`](../prisma/schema.prisma):

- `candles`: primary key `(mint, interval, open_time)`; `interval` is `D1` or
  `H1`. Prices are USD doubles. **Only closed candles are stored**, so a row
  never changes once written and inserts can skip duplicates.
- `tracked_mints`: the mints the sync job maintains, plus the last sync time
  and last error for each.

Daily candles open at 00:00 UTC. `toMarketData`
([`src/lib/market/candles.ts`](../src/lib/market/candles.ts)) lays them on a
gap-free UTC date axis, with `null` where a mint has no candle. That is the
input `evaluate()` reads.

## Sync job: `GET /api/cron/prices`

[`src/app/api/cron/prices/route.ts`](../src/app/api/cron/prices/route.ts) runs
[`syncPrices`](../src/lib/market/sync.ts). For each tracked mint, least
recently synced first:

1. **Backfill** when nothing is stored yet: 3 years of `1D` and 90 days of `1H`
   (`BACKFILL_DAYS`). A token listed more recently returns whatever history
   exists.
2. **Append**: every closed candle after the latest stored one. When the mint
   is already up to date, no request is made.

The job is idempotent, so rerunning it is safe. One failing mint is recorded in
`tracked_mints.last_error` and the job moves on to the next. Requests are spaced
1.1 seconds apart to respect the free plan's 1 request/second. After 4 minutes
the job stops starting new mints and returns them under `deferred`; the next
run takes them first.

- **Auth:** `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends this
  automatically. Without `CRON_SECRET`, the route is open in development and
  rejects every request in production.
- **Which mints:** the mints the example symphonies use are always tracked.
  Add more with `?track=<mint>,<mint>` (up to 50 per call).
- **Schedule:** [`vercel.json`](../vercel.json) runs the job daily at 00:10
  UTC, just after the daily candle closes. Each run appends one `1D` candle and
  24 `1H` candles per mint, at about 50 CU per mint per day. On the free plan's
  30k CU/month that covers about 15 mints, with room left for backfills (175
  CU per new mint). Hourly runs would cost about 600 CU per mint per day and
  need a paid plan (Lite: 2.5M CU).
- **Running it locally:** `curl localhost:3000/api/cron/prices`. The first run
  for the 7 default mints takes about 15 seconds (14 requests at 1 per second).

## Short histories

Every indicator in [`src/lib/indicators/`](../src/lib/indicators) is a pure
function that returns `null` when the series is too short (`barsRequired`). A
gap in a token's data also cuts its history short. `evaluateWithWarnings`
never fails on missing history. Instead it falls back as follows and returns
an `EvaluationWarning` for each fallback:

| Node               | Fallback                                                  |
| ------------------ | --------------------------------------------------------- |
| `if`               | Takes the **else** branch                                 |
| `filter`           | Ranks the child **last**; it's still picked if N needs it |
| inverse-volatility | Weights the group's children **equally**                  |

`describeWarning` turns a warning into one sentence, which `/symphonies` shows
above each allocation.
