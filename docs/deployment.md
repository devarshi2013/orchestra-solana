# Deploying to production (Vercel)

Orchestra is a Next.js 16 app with **no database** and **no cron jobs**. Vercel hosts it; `pnpm build` is the build command. It first runs `pnpm sync:stocks --refresh` (a few minutes: it re-verifies the issuers' stock lists and re-quotes the listed stocks on Jupiter, using `JUPITER_API_KEY`), then `next build`. The sync never fails the build; set `SYNC_STOCKS=skip` to skip it. Node 22.6 or later is required (`engines` in `package.json`).

## What runs where

| Piece             | Where                                                                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages and UI      | Browser. The only env it sees is `NEXT_PUBLIC_SOLANA_RPC_URL` (never a secret).                                                                                                    |
| `/api/*` routes   | Vercel serverless functions (Node). Every provider key is used only here, behind `server-only`.                                                                                    |
| Claude            | `/api/agent`, server-side only.                                                                                                                                                    |
| Jupiter swaps     | The assistant's buy flow gets an unsigned order from `/api/swap/order`, the **user's wallet signs it** (the app never holds keys), and `/api/swap/execute` forwards it to Jupiter. |
| Chats, disclosure | In the browser (no database).                                                                                                                                                      |

## Environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production and Preview), never in code.

| Variable                     | Required         | Notes                                                                          |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------ |
| `JUPITER_API_KEY`            | **yes**, secret  | From https://developers.jup.ag/portal                                          |
| `ANTHROPIC_API_KEY`          | for chat, secret | Without it, the assistant answers 503 and the rest works                       |
| `MARKET_DATA_API_KEY`        | no, secret       | Financial Modeling Prep, for stock fundamentals                                |
| `JUPITER_API_BASE_URL`       | no               | Defaults to `https://api.jup.ag`                                               |
| `SOLANA_RPC_URL`             | no               | Defaults to the public mainnet RPC; a provider URL is better (secret if keyed) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | no               | Browser RPC; defaults to the public mainnet RPC. Must not contain a secret     |

How the variables are checked:

- **Blank values** count as unset.
- **Quotes:** values pasted with surrounding quotes are accepted.
- **Missing values:** on Vercel, a missing variable is a build warning rather than a failure; requests that need it return an error naming it.
- **Health check:** `GET /api/health` lists missing variables by name (never values).

## Deploying

1. In Vercel, import the GitHub repo. It detects Next.js and pnpm.
2. Add the variables above.
3. Deploy. Every push to `main` redeploys.

## Limits

- `/api/agent` streams for up to 300 s (`maxDuration`). That needs Fluid compute (the default for new projects) or a paid plan.
- The chat rate limit is per client IP and lives in memory, so each function instance counts separately.
