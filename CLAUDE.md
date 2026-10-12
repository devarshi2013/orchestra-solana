# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Tickertape: an AI research chatbot and trading UI for tokenized US stocks on Solana (any issuer Jupiter verifies: xStocks, Ondo, Backpack, PreStocks…), buyable through Jupiter. Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, shadcn/ui, Anthropic SDK, Zod 4, pnpm. No database, no test suite. The README describes routes, env and layout.

## Commands

```bash
pnpm dev                       # http://localhost:3000 (needs .env.local, see .env.example)
pnpm check                     # typecheck + lint + format:check; run before finishing
pnpm typecheck                 # SKIP_ENV_VALIDATION=1 next typegen && tsc --noEmit
pnpm lint / pnpm lint:fix
pnpm format                    # Prettier with Tailwind class sorting
pnpm db:migrate                # create the strategies tables in DATABASE_URL (Neon)
pnpm strategies:watch          # dev: run the strategy watcher every 30 s
```

## Architecture

**Layering and the client/server boundary.**

- `src/server/**` is server-only (`import "server-only"`): Jupiter client (`jupiter/client.ts`, the only place that attaches `x-api-key`; it never retries), Claude agent (`agent/`), market data (FMP fundamentals, CoinGecko on-chain charts), Solana RPC, in-memory cache.
- `src/app/api/**/route.ts` are thin route handlers over `src/server`; errors use the `{ error: { message, ... } }` envelope from `src/server/http.ts`, parsed in the browser by `src/lib/api-client.ts`.
- `src/lib/**` is isomorphic, pure logic (Zod schemas, plan validation, quote math, formatting, friendly errors) and holds most unit tests.
- `src/components/**` and `src/hooks/**` are client code. ESLint forbids them from importing `serverEnv` / `envProblems` from `@/env` or anything from `@/server/*`.
- Env: one file, `src/env.ts`: the Zod schemas plus `serverEnv` (server code only) and `clientEnv`, each variable validated on first read (blank = unset, no defaults).

**Stock universe.** No stock list in the code. `src/server/stocks/universe.ts` reads Jupiter's `tokens/v2/tag?query=verified` (cached 60 s) and keeps tokens that are verified, tagged `stocks` and not flagged suspicious (`isStockToken`), then groups them one row per company by the ticker each issuer encodes in its symbol (`src/lib/stocks/group.ts`, rules in `issuers.ts`; unknown issuers stay on their own). Lookups by ticker, symbol or mint go through it; route contracts are in `src/lib/stocks/api.ts` (`/api/stocks`, `/search`, `/[ticker]`, `/history`). Mint addresses only ever come from the universe, never from the model or user input; swap/balance/quote routes reject other mints. Charts: GeckoTerminal's busiest pool per mint (`src/server/stocks/history.ts`). No sectors, types or trading hours exist (Jupiter has none).

**Chat agent** (`POST /api/agent` → `src/server/agent/loop.ts`). Claude tool-use loop streamed as SSE (`text`, `progress`, `tool`, `tool_result`, `plan`, `error`, `history`, `done`). The browser keeps the conversation (localStorage, `src/lib/assistant/chat-history.ts`) and resends `history` each turn. Tools are in `src/server/agent/tools.ts` (`searchStocks`, `getStockMetrics` only when `MARKET_DATA_API_KEY` is set, `getSwapQuote`, `getWalletBalances`, `submit_plan` with items named by token symbol); the wallet is never a model input. Without a wallet, `guest.ts` stubs wallet tools. Guardrails: `submit_plan` re-validates against the live universe and USDC balance (`src/lib/agent/plan.ts`), the stream redacts base58 addresses (`src/lib/agent/redact.ts`), and every number must come from a tool result. Prompt is `src/lib/agent/prompt.ts`; system prompt and tools must stay byte-stable for prompt caching. Per-IP in-memory rate limiting in `rate-limit.ts`.

**Buying** (plan card in chat, trade panel on a stock's page). Client hooks (`use-plan-buy.ts`, `use-trade.ts`, `use-plan-quotes.ts`) call `/api/swap/order` → wallet `signTransaction` → `/api/swap/execute`, one wallet prompt per item, re-quoting if the order expired. Nothing is retried automatically (429s included). User-facing errors go through `src/lib/friendly-error.ts`: one short line, never raw Jupiter messages, IDs or JSON (full details go to the console).

**Strategies** (`src/server/{db,auth,strategies}`, contract `src/lib/strategies/types.ts`). Neon Postgres via `postgres` (TLS, `prepare: false` for the pooler); every table is schema-qualified (`T.users` … in `src/server/db/schema.ts`, schema `tickertape`) because the pooler doesn't keep a search_path. Wallet sign-in signs a one-time nonce message → HMAC-signed HttpOnly cookie (`requireWallet`). The watcher (`/api/strategies/run`, Bearer CRON_SECRET, Vercel Cron) triggers strategies from Jupiter Price v3 and notifies (DB + optional webhook); the user buys with their wallet and `/api/fills` records the swap after reading it back from the chain. Daily portfolio snapshots and the fills × daily-closes backfill are in `src/server/portfolio/history.ts` (`/api/portfolio/history`). Client: `authApi`, `strategiesApi`, `profileApi`, `portfolioApi`, `pricesApi`, `recordFill` in `src/lib/api-client.ts`, `useSession()` in `src/hooks/use-session.ts`.

## Conventions

- No hardcoded stocks, tickers, mints or pools, and no fallbacks: env URLs are required (no defaults), a failed upstream call surfaces its error (never stale, substitute or assumed data), and unknown figures stay null/"unknown" (never 0). Optional keys switch a feature off; nothing stands in for them.
- The UI uses the tokens.xyz design system; its tokens live in `src/app/globals.css`.
- Logo: `src/components/brand/tickertape-mark.tsx` holds the mark's path data (inline `TickertapeMark`, and `markSvg` for the Apple icon and OG image). `src/app/icon.svg` is a static copy of the same paths: change both together.
- TS `lib` is es2023, but browsers are Chrome/Firefox 111+ and Safari 16.4+ with no polyfills: code reachable from the browser (components, hooks, `src/lib`) must not use `toSorted`/`toReversed`/`with`, `Object.groupBy`/`Map.groupBy` or Set methods. Server-only code (`src/server`, `src/app/api`) may.
- When behaviour changes, update the README tables.
- `AGENTS.md` contains a block regenerated by `next dev`; keep it committed.
