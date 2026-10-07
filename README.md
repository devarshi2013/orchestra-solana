# Orchestra

Build rule-based Solana token portfolios ("symphonies") visually, backtest them, and run them with periodic rebalancing. Inspired by [Composer](https://composer.trade).

> **Status:** scaffold only. No features yet.

## Ground rules

- **No custom smart contracts or on-chain programs.** All on-chain execution goes through Jupiter's REST APIs.
- **Non-custodial.** The user's wallet signs every transaction. We never hold keys or funds, and we never use Jupiter products that deposit into custodial vaults (Trigger v2 / DCA). See [docs/jupiter-api.md §0](docs/jupiter-api.md).
- **The Jupiter API key is server-only.** The browser calls our `/api/*` route handlers, which forward requests to `api.jup.ag` through `src/server/jupiter/client.ts`. Never use `lite-api.jup.ag`.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript (strict) · Tailwind v4 · shadcn/ui · Zustand · `@solana/web3.js` + `@solana/wallet-adapter` · Zod · Prisma 7 + Postgres · Vitest · ESLint + Prettier · pnpm

## Getting started

Requirements: Node ≥ 20.9, pnpm, and Docker (for local Postgres).

```bash
pnpm install                      # also runs `prisma generate`
cp .env.example .env.local        # read by Next.js
cp .env.example .env              # read by the Prisma CLI
# then set JUPITER_API_KEY (https://developers.jup.ag/portal) in both files

pnpm db:up                        # start Postgres in Docker
pnpm db:migrate                   # apply migrations (none yet)
pnpm dev                          # http://localhost:3000
```

## Environment

Variables are validated with Zod in [`src/env/schema.ts`](src/env/schema.ts). `next dev` and `next build` fail fast if any are invalid. Set `SKIP_ENV_VALIDATION=1` only for jobs that have no secrets, such as lint-only CI.

| Variable                     | Scope   | Purpose                                                                 |
| ---------------------------- | ------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`               | server  | Postgres connection string                                              |
| `JUPITER_API_KEY`            | server  | Sent as `x-api-key` to `api.jup.ag`                                     |
| `JUPITER_API_BASE_URL`       | server  | Defaults to `https://api.jup.ag`; `lite-api` is rejected                |
| `SOLANA_RPC_URL`             | server  | RPC for server-side reads (can hold a provider key)                     |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | browser | `mainnet-beta` (default) or `devnet`. Jupiter swaps are mainnet-only.   |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | browser | RPC for the wallet adapter. Use a public or origin-restricted endpoint. |

Import `serverEnv` from `@/env/server` (guarded by `server-only`) and `clientEnv` from `@/env/client`. ESLint stops client code (`src/components`, `src/hooks`, `src/stores`) from importing server modules.

## Scripts

| Script                                                    | Description                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm dev` / `build` / `start`                            | Next.js                                                      |
| `pnpm check`                                              | typecheck + lint + format check + tests                      |
| `pnpm typecheck`                                          | `next typegen && tsc --noEmit`                               |
| `pnpm lint` / `lint:fix`                                  | ESLint (Next core-web-vitals + TypeScript + Prettier compat) |
| `pnpm format` / `format:check`                            | Prettier, with Tailwind class sorting                        |
| `pnpm test` / `test:watch` / `test:coverage`              | Vitest                                                       |
| `pnpm db:up` / `db:generate` / `db:migrate` / `db:studio` | Docker Postgres and Prisma                                   |

## Layout

```
docs/jupiter-api.md          Jupiter endpoints, params, response shapes, and where they differ from the brief
prisma/schema.prisma         DB schema (no models yet)
prisma.config.ts             Prisma 7 CLI config (datasource URL comes from here, not the schema)
src/app/                     App Router pages and /api route handlers
src/components/ui/           shadcn/ui components (`pnpm dlx shadcn@latest add <name>`)
src/components/providers/    Client providers (Solana wallet)
src/env/                     Zod env schemas: server.ts (server-only), client.ts
src/server/                  Server-only code: db.ts (Prisma), jupiter/client.ts (keyed fetch)
src/generated/prisma/        Generated Prisma client (git-ignored)
```

## Wallets

Phantom, Backpack and Jupiter Wallet all implement the [Wallet Standard](https://github.com/wallet-standard/wallet-standard), so the wallet adapter detects them without per-wallet packages (`wallets={[]}`). Wallets only **sign** (`signTransaction`). Signed transactions go back through our API to Jupiter's `/execute`, which handles landing. This matters for RFQ routes, where the market maker co-signs during `/execute`.

## Notes

- Next.js is pinned to **16.3.8**. pnpm's `minimumReleaseAge` policy rejected 16.4.0 because it was published less than 24h before scaffolding. You can bump it once it has aged.
- `AGENTS.md` contains a block that `next dev` regenerates. Keep it committed.
