# Quill

An **AI research chatbot for tokenized US stocks on Solana**. Ask in plain English (for example "three large US tech stocks for 200 USDC"):

- The assistant researches **every tokenized stock and ETF buyable through Jupiter** (xStocks, Ondo Global Markets and PreStocks), by sector, with live data, and shows every tool call it used.
- It proposes a plan, with **live Jupiter quotes** for each stock.
- It **swaps your USDC for the stock tokens only after you approve each swap in your wallet**.

## Ground rules

- **Non-custodial.** Your wallet signs every swap (`signTransaction`; the app never sends from the wallet), and Quill never holds keys or funds. No Jupiter products that deposit into custodial vaults (Trigger v2 / DCA).
- **No custom smart contracts or on-chain programs.** All execution goes through Jupiter's Swap v2 REST API (`/order` + `/execute`).
- **Keys stay on the server.** The browser calls our `/api/*` routes, which call Jupiter (`src/server/jupiter/client.ts`) and Claude (`src/server/agent/client.ts`). Never use `lite-api.jup.ag`.
- **Registry-only stocks.** The assistant can only suggest stocks from the stock registry (`src/lib/stocks/registry.generated.json`), built only from the issuers' official lists and verified on Jupiter. Token addresses come from the registry, never from the AI.
- **No invented numbers.** Every figure the assistant states comes from a tool result, which the user can inspect under "Data used".

## Pages

| Route                 | What it does                                                                                                                                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                   | Live market dashboard: a Liveline hero chart (line/candles, 1H–30D) and a market grid for Solana tokens and tokenized stocks, with one "Ask Quill" button into the chat ([docs](docs/home-dashboard.md))                                                      |
| `/chat`, `/chat/[id]` | The chatbot (`/assistant` redirects here), with a ChatGPT-style chat history sidebar and a "Browse stocks" panel: streamed answers, "Data used" panels, plan cards with live quotes, warnings, pre-flight checks, and wallet-approved buys with Solscan links |

There's **no database**:

- **Chats:** they live in the browser tab, which sends the conversation back with each message.
- **Plans:** every plan is re-checked on the server against the live registry and wallet balance.
- **Disclosure:** the one-time risk disclosure is remembered in the browser.

See [docs/assistant.md](docs/assistant.md).

## Brand

- **Name and line:** Quill. "Write what you want. Own what you choose." (`src/lib/brand.ts`).
- **Mark:** an upward-pointing fountain-pen nib (it doubles as an "up" arrow): burgundy, with a cream slit and a gold breather hole; flat, no gradients. The shapes live in `src/components/brand/logo.tsx` and are shared by the favicon (`src/app/icon.svg`, which switches to the dark version with the OS theme), the apple-touch icon and OG image (generated in `src/app`), and the files in `public/brand/`: icon and horizontal wordmark (nib + "quill" in Fraunces, font embedded) for light and dark backgrounds, plus 512px and 192px PNG app icons.
- **Colours** (CSS variables in `src/app/globals.css`, exposed as Tailwind colours):
  - Light (the default): cream `#F6EFE4` background, `#FBF7F0` surfaces, white raised, `#E2D6C3` borders, ink `#2A1A1E` text, `#736350` muted text, burgundy `#6B1E2E` primary (hover `#551624`) with cream text, gold `#D9A441` for highlights (gold _text_ is `#8A6416`).
  - Dark: `#1A1012` background, `#241719` / `#2E1E21` surfaces, `#3D2A2E` borders, cream text, `#B8A894` muted, a lighter burgundy `#C25A6E` primary, gold `#E0B457`.
  - Data colours stay apart from the brand, so burgundy never reads as "down": positive green, negative a brighter red, neutral `#7A6A55`, always with a +/− sign or arrow. Charts use `#15803D` / `#DC2626` (light) and `#4ADE80` / `#F87171` (dark); price _text_ in light mode uses `#117235` / `#C81E1E` to stay at AA on cream.
  - Every text/background pair is checked for WCAG AA (contrast notes at the top of `globals.css`). Focus rings are a solid gold (`#A87A22` on light for 3:1, `#E0B457` on dark).
- **Type:** Fraunces (a literary serif) for headings and the wordmark, Inter for text, JetBrains Mono with tabular figures for prices and amounts (all via `next/font`).
- **Surfaces:** 1px borders, 8px controls and 14px cards, very soft warm shadows, and a faint paper grain on cream (off in dark mode). Your messages are burgundy bubbles; the AI's are surface cards.

## Stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 · shadcn/ui · `@solana/web3.js` + `@solana/wallet-adapter` · Anthropic SDK (Claude) · Zod · Vitest · pnpm

## Getting started

Requirements: Node ≥ 22.6 and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill in the keys below
pnpm dev                     # http://localhost:3000
```

## Environment

Variables are validated with Zod in [`src/env/schema.ts`](src/env/schema.ts). Blank values count as unset.

| Variable                     | Scope   | Required | Purpose                                                                               |
| ---------------------------- | ------- | -------- | ------------------------------------------------------------------------------------- |
| `JUPITER_API_KEY`            | server  | yes      | Sent as `x-api-key` to `api.jup.ag` (https://developers.jup.ag/portal)                |
| `JUPITER_API_BASE_URL`       | server  | no       | Defaults to `https://api.jup.ag`; `lite-api` is rejected                              |
| `ANTHROPIC_API_KEY`          | server  | for chat | Claude API key; without it the assistant answers 503                                  |
| `MARKET_DATA_API_KEY`        | server  | no       | Financial Modeling Prep key for stock fundamentals (market cap, P/E, growth, returns) |
| `SOLANA_RPC_URL`             | server  | no       | Server RPC for balances; defaults to the public mainnet RPC (may hold a provider key) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | browser | no       | Wallet-adapter RPC; defaults to the public mainnet RPC. Never put a secret here       |

Import `serverEnv` from `@/env/server` (guarded by `server-only`) and `clientEnv` from `@/env/client`. `GET /api/health` reports missing variables by name (never values).

## Scripts

| Script                                       | Description                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `pnpm dev` / `build` / `start`               | Next.js                                                                     |
| `pnpm check`                                 | typecheck + lint + format check + tests                                     |
| `pnpm typecheck`                             | `next typegen && tsc --noEmit`                                              |
| `pnpm lint` / `lint:fix`                     | ESLint                                                                      |
| `pnpm format` / `format:check`               | Prettier, with Tailwind class sorting                                       |
| `pnpm test` / `test:watch` / `test:coverage` | Vitest                                                                      |
| `pnpm sync:stocks`                           | Rebuild the stock registry (full, ~30 min); `pnpm build` runs a `--refresh` |

## Layout

```
docs/                        Assistant, home dashboard, tokenized stocks (issuers, sync), Jupiter API notes, deployment
src/app/                     Pages (/ and /chat) and /api route handlers
src/components/assistant/    Chat, plan card, data-used panels, disclosure and wallet gates
src/components/market/       Home dashboard: hero chart, market grid (Liveline)
src/hooks/                   Chat stream, plan quotes, plan buying
src/lib/agent/               System prompt, plan validation, address redaction
src/lib/stocks/              Stock registry + sync logic, best-issuer choice, tools (listStocks, metrics, quotes, balances)
scripts/sync-stocks.ts       Builds the stock registry from the issuers' official lists
src/server/agent/            Claude tool-use loop, tools, rate limit
src/server/jupiter/          Keyed Jupiter client (order, execute, prices, tokens)
src/env/                     Zod env schemas
```

## Wallets

Phantom, Backpack, Jupiter Wallet and other [Wallet Standard](https://github.com/wallet-standard/wallet-standard) wallets are detected automatically. Wallets only **sign** (`signTransaction`). Signed transactions go back through our API to Jupiter's `/execute`, which lands them; for RFQ routes the market maker co-signs there.

## Notes

- Tokenized stocks are securities with eligibility rules: they aren't available to US persons, and other regions restrict them (see [docs/tokenized-stocks.md](docs/tokenized-stocks.md)).
- This is research, not financial advice.
- `AGENTS.md` contains a block that `next dev` regenerates. Keep it committed.
