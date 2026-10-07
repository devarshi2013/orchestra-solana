# Deploying to production (Vercel)

Orchestra is a Next.js 16 app with Postgres (Prisma 7). Vercel hosts the app and runs its two daily cron jobs (`vercel.json`). The database must be a hosted Postgres that Vercel can reach. The local `docker-compose.yml` database is for development only.

## What runs where

| Piece               | Where                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages and UI        | Browser. The only env it sees is `NEXT_PUBLIC_*` (cluster and RPC URL; never secrets).                                                                                                                     |
| `/api/*` routes     | Vercel serverless functions (Node). All provider keys are used only here, behind `server-only`.                                                                                                            |
| Jupiter swaps       | The browser asks `/api/swap/order` for an unsigned transaction. The **user's wallet signs** it (`signTransaction`; the app never holds keys) and `/api/swap/execute` forwards the signed bytes to Jupiter. |
| Claude (assistant)  | `/api/agent` and `/api/investments/[id]/explanation`, server-side only.                                                                                                                                    |
| Price history       | `/api/cron/prices`, daily at 00:10 UTC. GeckoTerminal (keyless) by default, or Birdeye when `BIRDEYE_API_KEY` is set (server-side).                                                                        |
| Rebalance reminders | `/api/cron/rebalances`, daily at 00:20 UTC.                                                                                                                                                                |
| Database migrations | The `vercel-build` script runs `prisma migrate deploy` before `next build`.                                                                                                                                |

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production), never in code. Values marked _secret_ must not be shared or committed.

| Variable                                                                      | Required                  | Notes                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                | **yes**, secret           | Hosted Postgres, e.g. Neon or Vercel Postgres. Use the **pooled** connection string with `sslmode=require`.                              |
| `JUPITER_API_KEY`                                                             | **yes**, secret           | From https://developers.jup.ag/portal.                                                                                                   |
| `SOLANA_RPC_URL`                                                              | **yes**                   | Server RPC. The public endpoint works but is rate-limited; a provider URL (Helius, Triton…) is better, and is secret if it embeds a key. |
| `NEXT_PUBLIC_SOLANA_RPC_URL`                                                  | **yes**                   | Browser RPC for the wallet. Public, so use a public or origin-restricted endpoint.                                                       |
| `NEXT_PUBLIC_SOLANA_CLUSTER`                                                  | no                        | Defaults to `mainnet-beta` (Jupiter is mainnet-only).                                                                                    |
| `SESSION_SECRET`                                                              | **yes**, secret           | At least 32 characters (`openssl rand -hex 32`). Sign-in fails in production without it.                                                 |
| `CRON_SECRET`                                                                 | **yes**, secret           | At least 16 characters. Vercel Cron sends it automatically; the cron routes refuse requests without it.                                  |
| `APP_URL`                                                                     | **yes**                   | The production URL, e.g. `https://orchestra.vercel.app` (used in emails).                                                                |
| `ANTHROPIC_API_KEY`                                                           | for the assistant, secret | Without it, the assistant answers 503 and everything else works.                                                                         |
| `BIRDEYE_API_KEY`                                                             | no, secret                | Longer price history.                                                                                                                    |
| `MARKET_DATA_API_KEY`                                                         | no, secret                | Stock fundamentals (Financial Modeling Prep).                                                                                            |
| `COINGECKO_API_KEY`                                                           | no, secret                | Higher CoinGecko rate limit.                                                                                                             |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                | no, secret                | Rebalance emails. Without them, emails are only logged.                                                                                  |
| `VAPID_PRIVATE_KEY` (secret), `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | no                        | Web push (`npx web-push generate-vapid-keys`).                                                                                           |

The build validates these (`src/env/schema.ts`). A missing required variable fails the deploy with a message naming it.

## First deploy

1. Create a hosted Postgres database and copy its pooled connection string.
2. In Vercel, **Add New → Project** and import `devarshi2013/orchestra-solana`. Vercel detects Next.js and pnpm and uses the `vercel-build` script automatically.
3. Add the environment variables above, then click **Deploy**.
4. After the deploy, open `/api/cron/prices` from the Vercel dashboard (Cron Jobs → Run) once, so price history starts filling. Until it has run, backtests and today's allocation show "no stored prices".

## Limits to know

- **Function duration:** `/api/agent` streams for up to 300 s (`maxDuration`). That needs Fluid compute (on by default for new projects) or a paid plan.
- **Cron:** the Hobby plan allows daily cron jobs, which is what `vercel.json` uses.
- **Rate limits:** the assistant's per-wallet rate limit lives in memory, so each function instance counts separately.
