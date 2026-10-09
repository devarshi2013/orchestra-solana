# Stock assistant

`/assistant` is a chat that helps users find **tokenized US stocks on Solana**, shows **live Jupiter quotes**, and buys only after the user **approves each swap in their wallet**. The assistant itself never trades.

## Request flow

`POST /api/agent` with `{ wallet, message, history }` (`src/app/api/agent/route.ts`):

1. **Gate.** The request needs `ANTHROPIC_API_KEY` (server-only), or it gets a 503. The browser needs a connected wallet. Connecting only shares the public address, which the tools use for balances and quotes; there is no sign-in.
2. **Rate limit per client IP** (`src/server/agent/rate-limit.ts`): one response at a time, 20 per hour, kept in memory (per server instance). A rejected request gets a 429.
3. **No database.**
   - **Where history lives:** the browser keeps the conversation and sends it back as `history`, exactly as the previous reply's `history` event returned it (validated, capped at ~600 KB).
   - **What the client can't fake:** thinking blocks carry the API's signatures, so they can't be altered.
   - **What it could fake:** an edited tool result could only mislead the sender's own chat.
   - **Plans are re-checked:** every plan is validated again on the server against the stock registry and the live wallet balance before it's shown, and each buy is re-quoted before signing.
4. **The tool-use loop** (`src/server/agent/loop.ts`) streams each model turn as Server-Sent Events:
   - **Events:** `text`, `progress`, `tool`, `tool_result`, `plan`, `error`, `history` and `done`.
   - **Tool calls:** all of a turn's calls run together, and their results go back in one message.
   - **Stops:** on `refusal`, and on `max_tokens` when it cut a tool call short. It resumes `pause_turn`. It re-issues a turn only for unparseable streamed tool input.

## Model and request

| Setting      | Value                                                                       |
| ------------ | --------------------------------------------------------------------------- |
| Model        | `claude-opus-5-5`                                                           |
| Thinking     | `{ type: "adaptive", display: "updates" }` (progress notes shown as status) |
| Effort       | `high`                                                                      |
| Fallback     | `fallbacks: "default"` + beta `server-side-fallback-2026-07-01`             |
| Tools        | `strict: true` where possible, `eager_input_streaming: true`                |
| Caching      | top-level `cache_control` (system prompt and tools are byte-stable)         |
| `max_tokens` | 64,000 (streamed)                                                           |

## Tools (`src/server/agent/tools.ts`)

| Tool                | What it returns                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `listStocks`        | Registry companies by sector, industry, type (stock/ETF), search and minimum liquidity; echoes what it searched. Never mints       |
| `getStockMetrics`   | Market cap, P/E, revenue growth, 1M/6M/1Y returns (Financial Modeling Prep; null with a reason when unavailable)                   |
| `getSwapQuote`      | A live Jupiter quote for spending USDC on one stock, from the cheapest issuer: tokens out, price impact, fees. Never a transaction |
| `getWalletBalances` | The connected wallet's USDC and SOL                                                                                                |
| `submit_plan`       | Validates the final plan; errors go back to the model to fix                                                                       |

**The wallet is never a model input**: balance and quote tools always use the connected wallet. Every tool call is logged as one JSON line, without keys.

## Guardrails

| Rule                            | How it's enforced                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Only registry stocks            | `submit_plan` resolves every ticker against the stock registry; anything else is rejected                    |
| Never output a mint address     | No tool returns one; the stream also redacts any 32–44-character base58 token (`src/lib/agent/redact.ts`)    |
| Every number from a tool result | The prompt requires it; tools return null with a reason instead of estimating; "Data used" shows each result |
| Never execute                   | No tool can trade. Buying happens in the browser, one wallet signature per swap                              |

## Plan validation (`src/lib/agent/plan.ts`)

- **Format:** the plan is `{ items: [{ kind: "stock", ticker, usdcAmount, reason }], totalUsdc, rankingMethod }`.
- **Each item** resolves to a registry company. A ticker (NVDA) leaves the issuer to the buy, which quotes every issuer and takes the cheapest route; a token symbol (NVDAx) pins that issuer.
- **No duplicates** (the same company twice, even via different issuers), and every item is at least $10 (`MIN_ORDER_USD`).
- **The total** equals the items' sum and fits the wallet's live USDC.

Failures go back to the model as an error result. After three, it's told to stop and explain.

## Buying a plan

The plan card (`src/components/assistant/plan-card.tsx`) shows each stock with:

- **its amount**, editable or removable;
- **a fresh Jupiter quote** from the cheapest issuer (shown with its liquidity badge): tokens out, price impact and fees, from `POST /api/assistant/quote` and server-paced to fit the Jupiter rate limit;
- **warnings** (`src/lib/assistant/review.ts`): high price impact, low or thin liquidity, outside US market hours (not for pre-IPO tokens), or no buildable quote.

**Pre-flight checks:**

- The wallet is connected and can sign.
- Every item is at least $10.
- There's enough USDC, and enough SOL for fees.
- Every item has a buildable quote.

**Approve & buy** (`src/hooks/use-plan-buy.ts`) uses the non-custodial Jupiter swap flow, item by item:

1. A fresh `/api/swap/order` for this wallet.
2. The **wallet signs**; the app never sends from it.
3. A re-quote if the order expired while the wallet prompt was open.
4. `/api/swap/execute` lands the swap.

How it behaves:

- **Signing:** each stock is its own wallet prompt; nothing is signed automatically.
- **Token addresses:** the server's quote returns the chosen token from the stock registry; the model never supplies one.
- **Failures:** a failed item doesn't stop the others, while declining in the wallet stops the run.
- **Results:** each item shows its status and a Solscan link, and the summary offers **Retry** for anything not bought.

## Browse stocks

Next to the chat, the **Browse stocks** panel (`src/components/assistant/stock-browser.tsx`) lists every registry company from `GET /api/stocks` (no mints): sector chips, search, a stock/ETF toggle, and each company's liquidity badge. Clicking one sends "Tell me about TICKER" to the assistant.

## Disclosure

Before first use, the browser shows a one-time disclosure: AI can be wrong, it's not financial advice, tokenized stocks are securities with eligibility rules. Acceptance is stored in `localStorage` (`src/components/assistant/disclosure-gate.tsx`). Bumping `ASSISTANT_DISCLOSURE_VERSION` asks again.

## Tests

- `src/server/agent/loop.test.ts`: the loop against a fake streaming client.
- `src/server/agent/tools.test.ts`: stock-only tools and plan rejection.
- `src/app/api/agent/route.test.ts`: SSE, history round-trip, validation, 503, 429.
- `src/lib/agent/plan.test.ts`, `redact.test.ts`, `transcript.test.ts`.
- `src/lib/assistant/review.test.ts`, `market-hours.test.ts`.
- `src/lib/stocks/*.test.ts`: sync verification, liquidity tiers, sector mapping, registry filters, best-issuer selection.
