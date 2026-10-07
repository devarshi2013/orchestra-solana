# Investable-asset registry

`src/lib/assets/registry.ts` holds one typed list:
`{ kind: "stock" | "crypto", ticker, name, category, mint, issuer?, … }`.

**It is the only source of mint addresses in Orchestra.** No mint is ever typed
in, pasted in, or supplied by a model:

- The `/create` editor's asset picker lists only registry assets. There is no
  free-text mint field.
- `validateSymphony` reports any other mint as "Not in Orchestra's asset
  registry", including mints pasted into the JSON editor.
- `POST /api/investments` refuses symphonies with unlisted mints. Starting a
  rebalance refuses a symphony whose token has since been delisted.
- Saving a draft only starts price tracking for listed mints.
- Mints the app's own code needs (SOL, USDC, the example symphonies) come from
  `src/lib/assets/allowlist.ts`.

The `/swap` page is a general-purpose swap tool, not an investing feature, so
it keeps Jupiter's full token search.

## How it's built

At server start (`src/instrumentation.ts`), `src/server/assets/registry.ts`
builds the list without blocking startup, then rebuilds it every 6 hours
(`REGISTRY_REFRESH_MS`).

1. **Stocks:** all 1,722 official mints (see
   [tokenized-stocks.md](./tokenized-stocks.md)) are looked up in the Tokens API
   in batches of 100. `selectStocks` keeps those that are found, verified, not
   flagged and not Backpack-issued, and that trade at least `minLiquidityUsd`
   **or** `minVolume24hUsd` (Ondo trades mostly through RFQ, so volume counts).
2. **Crypto:** `GET /tokens/v2/tag?query=verified` (about 3,900 tokens).
   `selectCrypto` keeps the curated allowlist (it must still pass
   verification) plus discovered tokens that pass every filter, then adds USDC
   as cash.
3. Every Jupiter call is paced at about 1 per second. The first build makes
   about 20 requests and takes about 22 seconds. Exclusions are logged by
   reason.

## Filters (`src/lib/assets/config.ts`)

| Setting                     | Crypto                                                                                                                                                      | Stocks                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Jupiter-verified            | required                                                                                                                                                    | required                       |
| Not flagged (`audit.isSus`) | required                                                                                                                                                    | required                       |
| Liquidity                   | ≥ $1,000,000                                                                                                                                                | ≥ $100,000 **or** volume below |
| 24h volume                  | ≥ $500,000                                                                                                                                                  | ≥ $250,000                     |
| Age (first pool)            | ≥ 90 days                                                                                                                                                   | —                              |
| Excluded                    | stablecoins (`stable` tag + symbol list), `yb`, `jup-lend-earn`, tokenized stocks (`rwa`, `stocks`, `xstocks`, `ondo`, `prestocks`, `equities`), `backpack` | `backpack`                     |
| Cap                         | 60 picks                                                                                                                                                    | 80                             |

**Stablecoins are never investment picks.** USDC is in the registry only as
**cash**: symphonies can hold it, but it is labelled Cash.

On 2026-10-07 these settings gave **22 stocks** (20 xStocks, 2 Ondo) and **40
crypto**: SOL and liquid-staking SOL, wBTC, cbBTC, ETH, DeFi tokens (JUP, RAY,
JLP…), memes (BONK, WIF, TRUMP…) and the allowlist, plus USDC.

**The allowlist** (`allowlist.ts`): SOL, JUP, BONK, JTO, PYTH, RAY and WIF.
These are listed even below the thresholds (JTO and PYTH have about $0.4M of
liquidity) but still must pass verification. Their mints were copied from
Jupiter's verified list (strict tag), not typed from memory.

## /assets

The page has Stocks and Crypto tabs:

- live price and 24h change (Price API v3, cached for 30 seconds);
- issuer, sector and trading hours for stocks;
- a **liquidity check**: a $1,000 USDC → asset test quote (`/order`, no taker,
  nothing signed), cached for 15 minutes. It is flagged above 1% price impact,
  or as "No route" when Jupiter can't quote it.

The stocks tab carries the eligibility notice from
[tokenized-stocks.md](./tokenized-stocks.md).

## Tests

`src/lib/assets/registry.test.ts` covers:

- the official sources' integrity (only the two issuers, unique and valid
  mints, known mints match the issuers' publications);
- every rejection reason for stocks and crypto;
- the allowlist being exempt from thresholds but not from verification;
- stablecoin exclusion, USDC as cash, caps and ordering.

`src/lib/assets/format.test.ts` covers price, change and "thin" formatting.
