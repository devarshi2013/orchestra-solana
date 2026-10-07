# Jupiter API reference for Orchestra

Source: <https://developers.jup.ag/docs> (the `llms.txt` index, product pages, and the OpenAPI specs under `/docs/openapi-spec/...`), read on **2026-10-07**. Re-check before relying on edge cases; Jupiter publishes breaking changes at <https://developers.jup.ag/changelog>.

> **Read §0 first.** Some of the docs disagree with the original project brief.

---

## 0. Where the docs differ from the brief

| #   | Brief said                                               | What the docs say                                                                                                                                                                                                                                            | Impact / decision                                                                                                                                                                                                                                                                         |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Use the **Recurring API**                                | The Recurring API (`/recurring/v1`) is **unmaintained** ("superseded by DCA"). Its replacement is **Trigger API v2 DCA** (`/trigger/v2/orders/dca`).                                                                                                         | See #2.                                                                                                                                                                                                                                                                                   |
| 2   | Non-custodial: the user's wallet signs every transaction | Trigger v2 (DCA and limit orders) deposits funds into a **"Privy-managed custodial vault"**. The Jupiter keeper then runs each round without the user signing it. It also needs JWT challenge-response auth.                                                 | **Trigger v2 breaks the non-custodial constraint.** Recurring v1 is unmaintained. Both are single-pair DCA, not multi-asset rebalancing. **Decision: use neither.** Rebalancing is built on Swap v2 `/order` + `/execute`. The endpoints are listed in §5 for reference only.             |
| 3   | "Run them with periodic rebalancing"                     | `/order` transactions expire quickly. Aggregator routes expire at `lastValidBlockHeight` (about a minute). RFQ (JupiterZ) routes expire at `expireAt`, which is shorter. Jupiter says to sign and submit right away.                                         | Transactions can't be pre-signed, and nothing can run unattended without custody. "Periodic" means: our server works out when a rebalance is due and what trades it needs → we notify the user → the user opens the app → we get fresh `/order`s → the wallet signs → we call `/execute`. |
| 4   | Backtesting (implied: Jupiter data)                      | No Jupiter API among these offers **historical** prices. Price API v3 returns **spot only** (last swap price).                                                                                                                                               | **Decided:** daily and hourly OHLC candles from GeckoTerminal (keyless, last 180 days) or Birdeye (with a key), stored in Postgres by `/api/cron/prices`. See [market-data.md](./market-data.md).                                                                                         |
| 5   | `x-api-key` header                                       | Correct. The docs also allow **keyless** access at 0.5 RPS. Keys look like `jup_...`. **Rate limits apply per organisation, not per key.** Free = 1 RPS (60/min), shared across Swap, Price and Tokens. `/swap/v2/execute` has its own bucket (Free 50 RPS). | We always send the key (env validation requires it). On the Free tier we must cache Price/Tokens responses on the server. One rebalance with N legs uses N `/order` calls from the shared bucket.                                                                                         |
| 6   | Never use lite-api                                       | Agreed: `lite-api.jup.ag` is being phased out.                                                                                                                                                                                                               | The env schema rejects any `lite-api.*` base URL.                                                                                                                                                                                                                                         |
| 7   | —                                                        | `/order` handles **one pair and `ExactIn` only**. A multi-asset rebalance is a sequence of swaps, each signed separately.                                                                                                                                    | Run sell legs first, then size buy legs from the actual `totalOutputAmount`. Each leg needs a fresh `/order`.                                                                                                                                                                             |
| 8   | —                                                        | Jupiter's own examples sign with `partiallySignTransaction`, because JupiterZ (RFQ) routes need a market-maker signature that is added during `/execute`.                                                                                                    | Use the wallet's **`signTransaction`**, never `sendTransaction` / `signAndSendTransaction`. Send the base64 signed transaction to our `/api` route, which forwards it to `/execute`.                                                                                                      |
| 9   | —                                                        | `maxSupportedTransactionVersion=1` can return v1 transactions, and `@solana/web3.js` v1 cannot sign those.                                                                                                                                                   | Leave the default (`"0"`).                                                                                                                                                                                                                                                                |
| 10  | —                                                        | Jupiter charges a platform fee on `/order` swaps: 0 bps (stable↔stable, LST↔LST), 2 bps (SOL↔stable), 5 bps (LST↔stable), 10 bps (everything else), 50 bps (tokens less than 24h old).                                                                       | The backtest cost model has to include these.                                                                                                                                                                                                                                             |

---

## 1. Common

- **Base URL:** `https://api.jup.ag`
- **Auth:** `x-api-key: <JUPITER_API_KEY>`. We send it from the server only (`src/server/jupiter/client.ts`).
- **Debugging:** every response includes `x-api-gateway-request-id`. Log it, and quote it to Jupiter support.
- **Rate-limit headers** (on 200 and 429 responses only): `x-ratelimit-remaining` (signed, so it can go negative), `x-ratelimit-current`, `x-ratelimit-reset` (Unix **seconds** when one slot frees up). The window is a 60s sliding window. There is no penalty lockout, so back off until `reset`.
- **HTTP codes:** `400` bad params · `401` invalid or unknown key (a _missing_ key counts as keyless, not 401) · `403` key lacks permission for the endpoint, or a firewall rule blocked it · `429` rate limit (`[API Gateway] Too many requests` = plan limit; `Too many requests` = firewall rule) · `5xx` retry with backoff.

| Tier      | RPS | RPM   |
| --------- | --- | ----- |
| Keyless   | 0.5 | 30    |
| Free      | 1   | 60    |
| Developer | 10  | 600   |
| Launch    | 50  | 3,000 |
| Pro       | 150 | 9,000 |

`/swap/v2/execute` has a separate bucket: Keyless 20 · Free 50 · Paid 100 RPS.

---

## 2. Swap API v2: Meta-Aggregator (`/order` + `/execute`)

Base: `https://api.jup.ag/swap/v2`. All routers (Metis, JupiterZ RFQ, Dflow, OKX) compete for each quote, and Jupiter handles slippage (RTSE), priority fees and transaction landing.
(The Router path `/build` returns raw instructions and has no managed landing. We don't need it.)

### `GET /swap/v2/order`

| Param                                    | Req | Type                         | Notes                                                                                          |
| ---------------------------------------- | --- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `inputMint`                              | ✓   | string                       | Mint being sold                                                                                |
| `outputMint`                             | ✓   | string                       | Mint being bought                                                                              |
| `amount`                                 | ✓   | string                       | Smallest units of `inputMint`                                                                  |
| `taker`                                  | –   | string                       | User's wallet. **Without it you get a quote only** (`transaction: null`). Useful for previews. |
| `receiver`                               | –   | string                       | Output recipient wallet. Must differ from `taker`.                                             |
| `swapMode`                               | –   | `"ExactIn"`                  | Only ExactIn is supported                                                                      |
| `slippageBps`                            | –   | int 0–10000                  | Omit to let RTSE choose (recommended). Setting it switches `mode` to `manual`.                 |
| `referralAccount` + `referralFee`        | –   | string + number (50–255 bps) | Integrator fee (Jupiter takes 20%). Optional, for monetisation later.                          |
| `payer`                                  | –   | string                       | Integrator gasless. **Disables JupiterZ/Dflow/OKX** (Metis only).                              |
| `priorityFeeLamports`, `jitoTipLamports` | –   | number                       | Overrides the automatic fee                                                                    |
| `broadcastFeeType`                       | –   | `maxCap` \| `exactFee`       |                                                                                                |
| `excludeRouters`                         | –   | csv                          | `metis,jupiterz,dflow,okx`                                                                     |
| `excludeDexes`                           | –   | csv                          | Metis only. Labels are case-sensitive.                                                         |
| `maxSupportedTransactionVersion`         | –   | `"0"` \| `"1"`               | Default `"0"`. **Keep the default** (§0 #9).                                                   |

Any optional param except `receiver` and referral switches `mode` from `"ultra"` to `"manual"`, which may narrow routing.

**200 response (fields we use):**

```ts
type OrderResponse = {
  requestId: string; // pass to /execute
  transaction: string | null; // base64 tx; null = no taker; "" = quoted but can't build (see errorCode)
  transactionVersion?: 0 | 1;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string; // outAmount is before slippage
  otherAmountThreshold: string; // min out after slippage
  slippageBps: number;
  priceImpact: number; // percentage points (-0.1 = -0.1%); priceImpactPct is deprecated
  inUsdValue?: number;
  outUsdValue?: number;
  swapUsdValue?: number;
  router: "metis" | "jupiterz" | "dflow" | "okx";
  mode: "ultra" | "manual";
  feeBps: number; // total fee (platform + e.g. gasless recoup)
  feeMint: string;
  platformFee?: { amount: string; feeBps: number; feeMint: string };
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
    };
    percent: number;
    bps: number;
    usdValue?: number;
  }[];
  gasless: boolean;
  signatureFeeLamports: number;
  prioritizationFeeLamports: number;
  rentFeeLamports: number;
  lastValidBlockHeight?: string; // aggregator expiry
  expireAt?: string;
  quoteId?: string;
  maker?: string; // RFQ only
  taker: string | null;
  errorCode?: number;
  errorMessage?: string; // present when transaction === ""
};
```

`400` → `{ requestId?, error }`.

**`/order` error codes** (only when `transaction === ""`; match on `router` **and** `errorCode`, never on the message text):

| errorCode | metis / dflow / okx        | jupiterz             |
| --------- | -------------------------- | -------------------- |
| 1         | Insufficient input balance | Insufficient balance |
| 2         | Insufficient SOL for gas   | Missing ATA          |
| 3         | Below gasless minimum      | Quote not buildable  |

### `POST /swap/v2/execute`

Body: `{ signedTransaction: string /* base64 */, requestId: string, lastValidBlockHeight?: string }`

```ts
type ExecuteResponse = {
  status: "Success" | "Failed";
  code: number; // 0 = success
  signature?: string; // present on success and on some failures
  slot?: string;
  error?: string;
  totalInputAmount: string; // deducted from wallet (incl. fee if feeMint = input)
  totalOutputAmount: string; // received in wallet (after fee if feeMint = output)
  inputAmountResult: string; // into the route
  outputAmountResult: string; // out of the route
  swapEvents?: unknown[];
};
```

`400` → `{ error, code }` · `500` → `{ signature?, error }`.

| code         | Meaning                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------- |
| 0            | Success                                                                                     |
| -1 / -2 / -3 | requestId missing or expired / invalid signed tx / invalid message bytes                    |
| -1000…-1004  | Aggregator: failed to land / unknown / invalid tx / not fully signed / invalid block height |
| -2000…-2004  | RFQ: failed to land / unknown / invalid payload / quote expired / swap rejected             |

Use `totalInputAmount` / `totalOutputAmount` for portfolio accounting (they're what actually moved in the wallet). Fee in the input mint = `totalInputAmount − inputAmountResult`. Fee in the output mint = `outputAmountResult − totalOutputAmount`.

### Observed behaviour (live api.jup.ag, 2026-10-07)

Not in the docs, but seen in real responses. Fixtures are in `src/lib/jupiter/__fixtures__/`.

- **Without `taker`:** `slippageBps` is `0` and `otherAmountThreshold` equals `outAmount`, because RTSE only runs for real orders. Don't show these as the user's slippage.
- **`priceImpact` can be positive or negative.** Display `Math.abs`.
- **Dust amounts** (e.g. 1 lamport) → `400 { requestId, error: "Failed to get quotes" }`. There is no `errorCode` for this. Jupiter's only documented minimum is the gasless one (about $10 when the taker holds less than 0.01 SOL → `errorCode 3`).
- **A taker that isn't a wallet** (e.g. a mint address) → `400 "Failed to get quotes"` or `"Invalid taker"`.
- **An unknown mint** → `500 { error: "Something unexpected occurred" }`.
- **JupiterZ (RFQ) orders** have **no `lastValidBlockHeight`**. Their expiry is `expireAt`, a **Unix-seconds string**, about 50s out. They are often `gasless: true` (the market maker pays fees).
- **`/execute` with an undecodable transaction** → `400 { code: -2, error: "Failed to decode signed transaction" }`.

### Orchestra flow (non-custodial)

```
browser ──GET /api/swap/order──▶ our server ──GET /swap/v2/order (x-api-key)──▶ Jupiter
browser ◀── { requestId, transaction(b64), quote fields }
wallet.signTransaction(VersionedTransaction.deserialize(b64))     // sign only, never send
browser ──POST /api/swap/execute { signedTransaction, requestId }──▶ our server ──POST /swap/v2/execute──▶ Jupiter
```

---

## 3. Price API v3

`GET https://api.jup.ag/price/v3?ids=<mint>,<mint>,...`. **Max 50 ids** per request.

```ts
type PriceResponse = Record<
  string /* mint */,
  {
    usdPrice: number;
    decimals: number;
    blockId: number | null; // freshness check
    priceChange24h: number | null; // percent (1.29 = +1.29%), not a fraction
    liquidity?: number; // USD
    createdAt?: string;
  }
>;
```

- Mints without a reliable price are **left out of the response** (no key, no null, no error). Diff the requested ids against the returned keys.
- A token is usually left out because it hasn't traded in 7 days or Jupiter's heuristics flagged it. Cross-check `audit.isSus` in the Tokens API.
- Spot price only (last swap). **No history** (§0 #4).

---

## 4. Tokens API v2

Base: `https://api.jup.ag/tokens/v2`

| Endpoint                     | Params                                                                                                                                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /search`                | `query` (req)                                                                                                                          | Symbol, name or mint. Comma-separate **mints only** for a batch lookup (max 100). Text search returns 20 by default.                                                                                                                                                                                                                                                                                                    |
| `GET /tag`                   | `query` = `verified` \| `lst`                                                                                                          | `verified` returns about 3,900 tokens with full stats; it feeds the crypto registry ([assets.md](./assets.md)). **`stocks` is now rejected** (`400 "Invalid tag provided."`, 2026-10-07), so stock mints come from the issuers ([tokenized-stocks.md](./tokenized-stocks.md)). Token tags seen: `stable`, `lst`, `meme`, `defi`, `major`, `strict`, `rwa`, `stocks`, `xstocks`, `ondo`, `backpack`, `yb`, `token-2022`. |
| `GET /{category}/{interval}` | `category` = `toporganicscore` \| `toptraded` \| `toptrending`; `interval` = `5m` \| `1h` \| `6h` \| `24h`; `limit` ≤ 100 (default 50) | Leaves out generic tokens such as SOL and USDC                                                                                                                                                                                                                                                                                                                                                                          |
| `GET /recent`                | –                                                                                                                                      | Recently created tokens that have a first pool                                                                                                                                                                                                                                                                                                                                                                          |

All return `MintInformation[]` (`400`/`500` → `{ error }`). Fields we care about:

```ts
type MintInformation = {
  id: string;              // mint
  name: string; symbol: string; icon: string | null; decimals: number;
  tokenProgram: string;    // SPL Token or Token-2022
  isVerified: boolean | null;
  tags: string[] | null;
  organicScore: number;    // 0-100, prefer this over organicScoreLabel
  organicScoreLabel: "high" | "medium" | "low";
  audit: { isSus?: boolean; /* other fields are conditional */ } | null;  // isSus is present only when flagged
  usdPrice: number | null; liquidity: number | null; mcap: number | null; fdv: number | null;
  holderCount: number | null;
  stats5m / stats1h / stats6h / stats24h: { priceChange, volumeChange, buyVolume, sellVolume, numBuys, numSells, numTraders, ... } | null;
  createdAt: string; updatedAt: string;
  mintAuthority: string | null; freezeAuthority: string | null;  // present only when not disabled
};
```

Trust levels: Verified (OK to display), Unverified (show with a warning), Banned (hide).

---

## 5. Recurring / Trigger v2: reference only, **not used**

Not used because of §0 #1–2. Recorded here so nobody adopts it later by accident.

- **Recurring v1** (`/recurring/v1`): unmaintained. Time-based recurring orders with on-chain order accounts. Minimum 100 USD total and 50 USD per order. 0.1% fee. No integrator fees.
- **Trigger v2** (`https://api.jup.ag/trigger/v2`): needs `x-api-key` **and** `Authorization: Bearer <JWT>`.
  - Auth: `POST /auth/challenge` `{ walletPubkey, type: "message" }` → sign the challenge → `POST /auth/verify` → `{ token }`. Also `/auth/refresh`, `/auth/logout`, `/auth/logout-all`.
  - Vault: `GET /vault`, `GET /vault/register`. **One custodial (Privy) vault per wallet.**
  - `POST /deposit/craft` `{ inputMint, outputMint, userAddress, amount, orderType: "dca" }` → `{ requestId, transaction }`
  - `POST /orders/dca`. Required: `depositRequestId, depositSignedTx, userPubkey, inputMint, outputMint, inputAmount, orderCount (≥2), intervalSeconds (60…31,536,000)`. Optional: `orderType: time_based | price_conditional`, `minPriceUsd`, `maxPriceUsd`, `triggerMint`, `beginFillAt`, `jlEnabled`, `jlMint`. Returns `{ id, txSignature }`. Minimum 10 USD per round.
  - `POST /orders/dca/cancel/{id}` → `POST /orders/dca/confirm-cancel/{id}`; `GET /orders/history/dca[/{id}]`
  - Price orders: `POST /orders/price`, `PATCH /orders/price/{id}`, cancel / confirm-cancel, `GET /orders/history`.
  - No integrator fees.
