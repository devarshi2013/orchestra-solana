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
- **Mark:** an upward-pointing fountain-pen nib (it doubles as an "up" arrow): navy with a white slit and breather hole on light backgrounds, white with black cut-outs on dark ones; flat, no gradients. The shapes live in `src/components/brand/logo.tsx` and are shared by the favicon (`src/app/icon.svg`, which switches with the OS theme), the apple-touch icon and OG image (generated in `src/app`), and the files in `public/brand/`: icon and horizontal wordmark (nib + "quill" in Fraunces, font embedded) for light and dark backgrounds, plus 512px and 192px PNG app icons.
- **Colours:** white, near-black, grays and one dark navy accent; nothing else. All are CSS variables in `src/app/globals.css`, exposed as Tailwind colours, so the theme is adjusted in one place.
  - Light (the default): white `#FFFFFF` page, off-white `#FAFAFA` cards and sections, near-black `#0A0A0A` text and headings, gray `#6B7280` secondary text, light gray `#E5E7EB` borders, dark navy `#0F1B2D` accent (hover `#1C2B44`).
  - The navbar is a navy band with white text in both themes (`.theme-navy`). The footer is `DitheredFooter` (`src/components/ui/dithered-footer.tsx`, MIT, from 21st.dev), set up in `src/app/layout.tsx`: "Quill" cut out in white from a field of navy dots that brighten under the cursor (light gray dots in dark mode). It links only to pages that exist, and has no email signup since there's no newsletter backend.
  - Dark: near-black page, gray surfaces, white text; the accent becomes white with navy text, since navy can't be read on black.
  - No red or green: price changes always carry a ▲/▼ and a +/− sign. Rises are navy (white in dark mode), falls gray or near-black. Liveline's candle and momentum colours are patched to match (`patches/liveline@0.0.7.patch`). Token and company logos are the projects' own images.
  - WCAG AA checked for every text/background pair (notes at the top of `globals.css`). Links inside text keep an underline, since navy and body text are too close to tell apart by colour alone.
- **Buttons:** navy with white text, 8–12px corners; hover lightens to `#1C2B44`, lifts 2px and adds a soft shadow. Secondary buttons are white with a navy border and text, filling navy on hover. 0.3s ease transitions.
- **Motion** (200–600ms, navy and gray only): sections fade and slide up as they scroll into view (`Reveal` in `src/components/motion.tsx`), link underlines grow from the left (`link-grow` / `link-inline`), cards lift with a soft navy-tinted shadow (`card-lift`), and a navy progress bar shows while a reply is written. All movement is off under `prefers-reduced-motion`.
- **Type:** Fraunces (a literary serif) for headings and the wordmark, Inter for text, JetBrains Mono with tabular figures for prices and amounts (all via `next/font`).
- **Surfaces:** 1px borders, 8px controls and 14px cards, very soft shadows. Your messages are navy bubbles; the AI's are off-white cards.

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
