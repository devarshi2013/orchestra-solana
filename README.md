# Tickertape

An **AI research chatbot and trading app for tokenized US stocks on Solana**. Ask in plain English (for example "three large US tech stocks for 200 USDC"):

- The assistant researches **every tokenized stock Jupiter verifies**, from any issuer (xStocks, Ondo Global Markets, Backpack Securities, PreStocks, Tessera, Shift…), with live data, and shows every tool call it used.
- It proposes a plan, with **live Jupiter quotes** for each token.
- It **swaps your USDC for the stock tokens only after you approve each swap in your wallet**.

## Ground rules

- **Keys stay on the server.** The browser calls our `/api/*` routes, which call Jupiter (`src/server/jupiter/client.ts`) and Claude (`src/server/agent/client.ts`). Never use `lite-api.jup.ag`.
- **No hardcoded stocks.** The stock universe is read live from Jupiter: every token it marks verified and tags `stocks` (`src/server/stocks/universe.ts`). Token addresses come only from there, never from the AI.
- **No fallbacks.** Missing configuration fails loudly; a failed request (rate limits included) shows its error instead of stale, substitute or assumed data. Nothing is retried automatically.
- **No invented numbers.** Every figure the assistant states comes from a tool result, which the user can inspect under "Data used".

## Data model

- **`StockToken`** (`src/lib/stocks/types.ts`): one Jupiter-verified stock token: mint, symbol, name, decimals, logo, issuer, and Jupiter's price, 24h change, liquidity, 24h volume, on-chain market cap and holders (null when Jupiter has no figure).
- **`Stock`**: a company with every issuer's token for it (NVIDIA: NVDAx and NVDAon; Micron: MU, MUx and MUon), grouped by the ticker each issuer encodes in its symbol (`src/lib/stocks/group.ts`, `issuers.ts`). Tokens from unknown issuers are listed on their own.
- There are no sectors, stock/ETF types or trading hours: Jupiter doesn't report them.

## Pages

| Page               | What it is                                                                       |
| ------------------ | -------------------------------------------------------------------------------- |
| `/` → `/chat`      | Research (the default page): the assistant, with chat history in the sidebar     |
| `/explore`         | Every listed stock: highlights, issuer tabs and the table                        |
| `/stocks/[ticker]` | One stock: chart, stats, each issuer's token, and the trade panel                |
| `/portfolio`       | Your portfolio: value and P&L, history, positions, strategies, activity, webhook |
| `/risk`, `/terms`  | Risks and terms                                                                  |

## API

| Route                                                                                       | What it returns                                                                                     |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /api/stocks`                                                                           | Every listed company, most liquid first (`StocksResponse`, `src/lib/stocks/api.ts`)                 |
| `GET /api/stocks/search?q=`                                                                 | Jupiter's token search, kept to listed stock tokens, as companies                                   |
| `GET /api/stocks/[ticker]`                                                                  | One company by ticker or token symbol; 404 when it isn't listed                                     |
| `GET /api/stocks/history?mint=&window=`                                                     | CoinGecko on-chain candles for a stock token (24h–1y); empty if no pool; 503 without a key          |
| `GET /api/swap/order`, `POST /api/swap/execute`                                             | Jupiter Swap v2 for USDC ↔ a listed stock token; the wallet signs in between                        |
| `GET /api/markets/balance?wallet&mint`                                                      | The wallet's USDC and its balance of one stock token                                                |
| `POST /api/agent`, `POST /api/agent/title`                                                  | The assistant                                                                                       |
| `POST /api/assistant/quote`, `GET /api/assistant/balances`                                  | A plan item's quote; the wallet's USDC and SOL                                                      |
| `GET /api/auth/nonce`, `POST /api/auth/verify`, `GET /api/auth/me`, `POST /api/auth/logout` | Sign in with the wallet (it signs a one-time message); an HttpOnly session cookie                   |
| `GET`/`POST /api/strategies`, `PATCH`/`DELETE /api/strategies/[id]`                         | The signed-in wallet's strategies (create, cancel, re-arm, delete)                                  |
| `GET`/`POST /api/strategies/run`                                                            | The watcher (`Authorization: Bearer CRON_SECRET`): triggers strategies, notifies, calls webhooks    |
| `POST /api/fills`                                                                           | Records a landed swap, read back from the chain                                                     |
| `GET`/`PATCH /api/profile`, `POST /api/profile/read`                                        | Positions with cost basis, strategies, fills, notifications; webhook URL; mark read                 |
| `GET /api/portfolio/history?period=7d\|30d\|90d\|1y`                                        | The portfolio, one point per day (value, P&L), today live; past days backfilled from recorded fills |
| `GET /api/prices?mints=`                                                                    | Jupiter's live price and 24h change, up to 50 mints                                                 |
| `GET /api/health`                                                                           | Which env variables are missing                                                                     |

The UI (home, stock pages, chat) is being rebuilt in the tokens.xyz design system on top of these routes.

There's **no database**:

- **Chats:** they live in the browser tab, which sends the conversation back with each message.
- **Plans:** every plan is re-checked on the server against the live stock universe and wallet balance.
- **Disclosure:** the one-time risk disclosure is remembered in the browser.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 · shadcn/ui · `@solana/web3.js` + Wallet Standard (no adapter) · Anthropic SDK (Claude) · Zod · pnpm

## Getting started

Requirements: Node ≥ 22.6 and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill in the variables below
pnpm dev                     # http://localhost:3000
```

## Environment

Variables are validated with Zod in [`src/env.ts`](src/env.ts), the only config file. Blank values count as unset. There are no defaults: a missing required variable stops `next dev` / `next build` / `next start`, naming it.

| Variable                     | Scope   | Required       | Purpose                                                                                   |
| ---------------------------- | ------- | -------------- | ----------------------------------------------------------------------------------------- |
| `JUPITER_API_KEY`            | server  | yes            | Sent as `x-api-key` to `api.jup.ag` (https://developers.jup.ag/portal)                    |
| `JUPITER_API_BASE_URL`       | server  | yes            | `https://api.jup.ag`; `lite-api` is rejected                                              |
| `SOLANA_RPC_URL`             | server  | yes            | Server RPC for balances (may hold a provider key)                                         |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | browser | yes            | Browser RPC (block height while a trade signs). Never put a secret here                   |
| `ANTHROPIC_API_KEY`          | server  | for chat       | Claude API key; without it the assistant is off (503)                                     |
| `MARKET_DATA_API_KEY`        | server  | no             | Financial Modeling Prep; without it the assistant has no fundamentals tool                |
| `COINGECKO_API_KEY`          | server  | for charts     | CoinGecko key (Demo or Pro); without it price charts are off                              |
| `DATABASE_URL`               | server  | for strategies | The Neon (Vercel Postgres) connection string; tables live in the `tickertape` schema      |
| `SESSION_SECRET`             | server  | for strategies | Signs wallet session cookies (32+ characters)                                             |
| `CRON_SECRET`                | server  | for strategies | Bearer token for `/api/strategies/run` (16+ characters); Vercel Cron sends it             |
| `COINGECKO_API_BASE_URL`     | server  | for charts     | `https://api.coingecko.com/api/v3` (Demo) or `https://pro-api.coingecko.com/api/v3` (Pro) |

Import `serverEnv` (server code only; ESLint keeps it out of components and hooks) and `clientEnv` from `@/env`. `GET /api/health` reports missing variables by name (never values).

## Scripts

| Script                         | Description                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start` | Next.js                                                                                       |
| `pnpm check`                   | typecheck + lint + format check                                                               |
| `pnpm typecheck`               | `next typegen && tsc --noEmit`                                                                |
| `pnpm lint` / `lint:fix`       | ESLint                                                                                        |
| `pnpm format` / `format:check` | Prettier, with Tailwind class sorting                                                         |
| `pnpm db:migrate`              | Creates the strategies tables in DATABASE_URL (idempotent; the app also runs it on first use) |
| `pnpm strategies:watch`        | Development: runs the strategy watcher every 30 s against the local server                    |

## Strategies

A strategy is a conditional buy: "buy $190 of NVDAx when its price drops below $220" (also price above, 24h change below/above, or every N days). After signing in with the wallet (it signs a one-time message; no password), strategies are kept in Postgres (Neon) with their fills and notifications.

- **Watching:** `/api/strategies/run` checks every watching strategy against Jupiter's live price. On Vercel it runs once a day via Vercel Cron (`vercel.json`, `0 0 * * *`: the Hobby plan allows only daily crons, so set `* * * * *` on Pro for every-minute checks; per-minute crons need the Pro plan, Hobby runs them daily), or any scheduler can call it with `Authorization: Bearer CRON_SECRET`. Locally, `pnpm strategies:watch`.
- **Triggered:** the strategy is marked triggered, the user gets a notification on their portfolio page and, if they set one, a POST to their webhook URL (`{ text, content, strategy, price, url }`: works as a Discord or Slack incoming webhook, or any receiver).
- **Buying:** the user opens the strategy and buys with one tap; their wallet signs. The swap is read back from the chain (`/api/fills`) and recorded against the strategy; a repeating strategy goes back to watching.
- **Profile:** positions (on-chain balances of listed stock tokens) with average cost from recorded fills, live value and P&L from `/api/prices`.
- **Portfolio history:** each watcher pass writes a daily snapshot (listed stock tokens + USDC at Jupiter's price) for every wallet that has signed in. The first time a wallet's history is read, past days are rebuilt once from its recorded fills × each token's daily close; days without a close for every holding are left out, and those days value only holdings bought through Tickertape.

## Layout

```
src/app/api/             Route handlers (stocks, swap, assistant, agent, health)
src/components/          UI, in the tokens.xyz design system
src/hooks/               Chat stream, chat history, plan quotes, plan buying, single trades
src/lib/agent/           System prompt, plan validation, address redaction
src/lib/stocks/          Stock types, issuer rules, grouping, route contracts, assistant tools
src/server/stocks/       The live stock universe (Jupiter) and chart history (CoinGecko on-chain API)
src/server/agent/        Claude tool-use loop, tools, rate limit
src/server/jupiter/      Keyed Jupiter client (order, execute, tokens)
src/server/db/           Postgres client and the idempotent schema migration
src/server/auth/         Wallet sign-in (nonce, ed25519 check) and session cookies
src/server/strategies/   Watcher, fill verification, profile (positions and cost basis)
src/env.ts               Env schemas and typed access (the only config file)
```

## Wallets

Phantom, Backpack, Jupiter Wallet and other [Wallet Standard](https://github.com/wallet-standard/wallet-standard) wallets are detected automatically. Wallets only **sign** (`signTransaction`). Signed transactions go back through our API to Jupiter's `/execute`, which lands them; for RFQ routes the market maker co-signs there.

## Notes

- Tokenized stocks are securities with eligibility rules: most aren't available to US persons, and other regions restrict them.
- This is research, not financial advice.
- `AGENTS.md` contains a block that `next dev` regenerates. Keep it committed.
