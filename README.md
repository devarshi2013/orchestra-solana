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
| `/`                   | Home page: hero, Quill Research™ / Search™ / Approve™, feature grid, FAQ, email signup and live sections: ticker tape, a real Jupiter quote, stats, markets table, sector heatmap ([docs](docs/home.md))                                                      |
| `/markets`            | Stocks screener: search, Equities / ETFs / Commodities tabs, top performers and a sortable table with live prices and 24h sparklines ([docs](docs/markets.md))                                                                                                |
| `/markets/[symbol]`   | One stock: live price, chart (1H–1Y), stats and a Buy / Sell panel; every trade is signed in your wallet                                                                                                                                                      |
| `/registry`           | Every listed token: company, issuer, mint with a Solscan link, and when it was last verified                                                                                                                                                                  |
| `/chat`, `/chat/[id]` | The chatbot (`/assistant` redirects here), with a ChatGPT-style chat history sidebar and a "Browse stocks" panel: streamed answers, "Data used" panels, plan cards with live quotes, warnings, pre-flight checks, and wallet-approved buys with Solscan links |

There's **no database**:

- **Chats:** they live in the browser tab, which sends the conversation back with each message.
- **Plans:** every plan is re-checked on the server against the live registry and wallet balance.
- **Disclosure:** the one-time risk disclosure is remembered in the browser.

See [docs/assistant.md](docs/assistant.md).

## Brand

- **Name:** Quill. One dark theme on every page; there is no light mode or theme switch.
- **Mark:** a "Q": a ring, a feather inside it, and the Q's tail as a pen nib (`src/components/brand/quill-mark.tsx`). White in the navbar; on navy as the favicon (`src/app/icon.svg`), Apple touch icon, install icons (`public/brand/`) and in the link-preview image.
- **Colours** (CSS variables at the top of `src/app/globals.css`, exposed as Tailwind colours): page `#07090D`, surfaces `#0D1117`, raised cards `#121821`, borders white at 8%, text `#F5F7FA`, muted text `#A3ACB9`, accents `#3B5BDB` / `#1E3A8A` (glows and graphics, never text), blue labels `#8FA4FF`, silver `#C9D0D7`, gains `#22C55E`, losses `#EF4444`, error text `#F87171`. WCAG AA checked (ratios in the comment above the tokens).
- **Type** (`src/app/fonts.ts`, via `next/font`): Sora for headings, Manrope for text, buttons, nav and cards, Instrument Serif Italic for accent words inside headings (`<em>`), Geist Mono with tabular figures for prices, numbers and small labels.
- **Navbar and footer:** the same navbar on every page (`src/components/layout/site-navbar.tsx`: Markets, Research, the home sections, "Launch app"; its border appears once scrolled) and the same `DitheredFooter` with blue dots (hidden on the chat, which fills the screen under the navbar).
- **Buttons:** white with dark text; outlined ones fill white on hover; a soft light sweeps across on hover.
- **Motion:** Lenis smooth scrolling on every page (`src/components/layout/smooth-scroll.tsx`; panels such as the chat scroll natively), fade-ins on scroll, hover lifts and glows. Movement is off under `prefers-reduced-motion`.

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
| `RESEND_API_KEY`             | server  | no       | Resend key for the email signup (`/api/subscribe`); signup answers 503 without it     |
| `RESEND_AUDIENCE_ID`         | server  | no       | Resend audience (now called a segment) that subscribers join                          |
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
src/components/home/         Home page sections (hero, feature rows and grid, FAQ)
src/components/markets/      Screener table, sparkline, price chart, trade panel, top performers
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
