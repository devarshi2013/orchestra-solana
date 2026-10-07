# Research assistant

`/assistant` is a chat, for signed-in wallets, that researches Orchestra's
assets with live data and proposes a USDC plan. **The assistant never
trades.** The user can review the plan, edit it and buy it from their own
wallet, signing every swap themselves ([Buying a plan](#buying-a-plan)).

## Request flow

`POST /api/agent` with `{ conversationId?, message }`
(`src/app/api/agent/route.ts`):

1. **Gate.** The request needs a Sign-In-With-Solana session
   ([invest.md](./invest.md)) and `ANTHROPIC_API_KEY` (server-only; otherwise
   it returns 503).
2. **Rate limit per wallet** (`src/server/agent/rate-limit.ts`): one response
   at a time, 20 per hour. A rejected request gets a 429 with `Retry-After`.
   The limit is kept in memory, so it is per server instance.
3. **History is stored server-side.** Conversations live in the
   `agent_conversations` table, owned by the wallet, and the browser sends
   only its new message. That way earlier tool results can't be forged by the
   client. The history is append-only, which Claude's thinking blocks require.
4. **The tool-use loop** (`src/server/agent/loop.ts`) streams each model turn:
   - Text, progress notes and tool activity go to the browser as Server-Sent
     Events: `conversation`, `text`, `progress`, `tool`, `tool_result`,
     `plan`, `error` and `done`.
   - `tool` carries the call's `id`, name and input. `tool_result` carries the
     same `id` and the result as the model saw it. Addresses in the result are
     redacted, and results over 20,000 characters are cut. These feed the
     "Data used" panel under each answer, so every figure can be checked
     against its source.
   - All of a turn's tool calls run, and their results go back in one message.
   - The loop stops on `refusal`, and on `max_tokens` when it cut a tool call
     short.
   - It resumes `pause_turn`.
   - It re-issues a turn only when a streamed tool input wasn't parseable JSON;
     API errors are reported, never retried.
   - The stored history is cut back to the last point where every tool call
     had its result, so a failure never leaves a broken conversation.

## Model and request

| Setting      | Value                                                                       | Why                                                                                                    |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Model        | `claude-opus-5-5`                                                           | Current default Claude model                                                                           |
| Thinking     | `{ type: "adaptive", display: "updates" }`                                  | Opus 5.5 always thinks; `updates` returns its short between-tool progress notes, shown as status lines |
| Effort       | `high` (set explicitly; Opus 5.5 defaults to `medium`)                      | Multi-step financial research deserves the deeper setting                                              |
| Fallback     | `fallbacks: "default"` + beta `server-side-fallback-2026-07-01`             | If a safety classifier declines, the request is re-run on Anthropic's recommended fallback model       |
| Tools        | `strict: true` where every field is required; `eager_input_streaming: true` | Inputs are still validated server-side (Zod) before anything runs                                      |
| Caching      | top-level `cache_control`                                                   | The system prompt and tools are byte-stable, so they're cached                                         |
| `max_tokens` | 64,000                                                                      | Streaming, so no HTTP timeout risk                                                                     |

**Opus 5.5 doesn't allow forcing a tool choice**, so the plan comes from the
model calling `submit_plan` because the prompt says to. The prompt is in
`src/lib/agent/prompt.ts`.

## Tools

The tools are the asset tools ([market-tools.md](./market-tools.md)) plus
`submit_plan`, defined in `src/server/agent/tools.ts`.

- **The wallet is never a model input.** `getWalletBalances` and
  `getSwapQuote` always use the signed-in wallet.
- **Every call is logged** as one JSON line: tool name, input, outcome,
  duration and a shortened wallet. Each run logs token usage. Keys and
  headers are never logged.

## Guardrails

| Rule                                         | How it's enforced                                                                                                                                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only suggest assets from `listAssets`        | The prompt says so. `submit_plan` resolves every ticker against the live registry and rejects anything else. Tools only accept tickers, never mints                                           |
| Never output a mint address                  | No tool returns a mint, so the model never sees one. As a backstop, the stream redacts any 32–44-character base58 token (`src/lib/agent/redact.ts`) before it reaches the browser             |
| Every number from a tool result              | The prompt says so, and tools return `null` with a reason instead of estimating. History is server-side, so a client can't inject fake tool results. Free-text numbers aren't machine-checked |
| State the ranking method and metrics         | The prompt says so, and `rankingMethod` is a required plan field shown on the plan card                                                                                                       |
| Mention risks and add "not financial advice" | The prompt asks for both; the UI shows the notice permanently and on every plan card                                                                                                          |
| Never execute                                | No tool can trade. `getSwapQuote` only quotes and never returns a transaction                                                                                                                 |

## Disclosure

Before first use, each wallet accepts a one-time disclosure
(`src/lib/assistant/disclosure.ts`):

- the AI can be wrong;
- plans are not financial advice;
- tokenized stocks are securities with eligibility rules;
- crypto is volatile.

Acceptance is stored per wallet in `assistant_disclosures`. `/api/agent`
and plan purchases return 403 without it. To ask everyone again, bump
`ASSISTANT_DISCLOSURE_VERSION`.

## Plan validation (`src/lib/agent/plan.ts`)

The plan is `{ items: [{ kind, ticker, usdcAmount, reason }], totalUsdc,
rankingMethod }`, validated with Zod and then checked against live data:

- **Every ticker** resolves to exactly one registry asset of that `kind`.
  Ambiguous tickers (AAPL → AAPLx or AAPLon) must use the token symbol.
- **No USDC items, and no duplicates.**
- **Every item is at least $10 USDC** (`MIN_LEG_USD`, Jupiter's minimum order
  size; see [invest.md](./invest.md)).
- **`totalUsdc` equals the items' sum** (within a cent) **and is at most the
  wallet's live USDC balance.**

Failures go back to the model as an `is_error` tool result listing every
problem in fixable terms. After three rejected attempts, the model is told to
stop and explain what blocks a valid plan. An accepted plan is streamed as a
`plan` event and shown as a card with no mints. The accepted plan is also
stored in the tool result, so a reopened chat shows its plan card again.

## Buying a plan

The plan card (`src/components/assistant/plan-card.tsx`) splits the plan into
**Stocks** and **Crypto**.

### Review

- **Each item** shows its name, symbol and ticker, the USDC amount (editable,
  or remove the item) and the reason.
- **A fresh Jupiter quote per item** shows tokens out, price impact and fees
  (Jupiter's fee, plus the network fee in SOL or "gasless"). It comes from
  `POST /api/assistant/quote`, which uses the same quote tool the model uses.
  Calls are server-paced to fit the 1 RPS Jupiter plan. Editing an amount
  re-quotes only that item; "Refresh quotes" re-quotes all of them.
- **Warnings** come from `src/lib/assistant/review.ts`:

  | Warning                   | When                                                                                                                                |
  | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
  | High price impact         | ≥ 1% (worded as "very high" from 5%)                                                                                                |
  | Thin liquidity            | The quote's impact is over the /assets threshold, or the buy is over 2% of the pool's liquidity                                     |
  | Outside US market hours   | Stocks only, outside 9:30–16:00 ET on weekdays and NYSE holidays (`src/lib/assistant/market-hours.ts`; holidays listed for 2026–27) |
  | No quote / can't be built | Blocks the item until it's fixed or removed                                                                                         |

### Pre-flight checks

All of these must pass before **Approve & buy** is enabled:

- **Wallet:** connected and able to sign (not watch-only).
- **Minimum:** every item is at least $10.
- **USDC:** the total is at most the wallet's USDC.
- **SOL:** enough for the network fees of every swap that isn't gasless, using
  the quoted fees, or 0.005 SOL each when Jupiter doesn't say.
- **Quotes:** every item has a buildable quote.

### Execution

Execution lives in `src/server/assistant/executions.ts` and
`src/hooks/use-plan-execution.ts`.

1. **The plan is recorded** with `POST /api/assistant/executions`. The edited
   amounts are re-checked with `validatePlan`, and each item's mint is
   resolved **from the registry by symbol**: never from the model or the
   browser.
2. **Items are bought one at a time** with the swap flow, through
   `POST /api/assistant/executions/[id]/items/[index]`:
   - `prepare`: the server checks the USDC balance and gets a Jupiter order
     with `taker` set to the wallet.
   - **The wallet signs** (`signTransaction`; it never sends).
   - If the quote expired while the wallet prompt was open, the item is
     re-quoted, up to 3 times.
   - `execute`: the server checks the signed transaction is exactly the order
     it issued, signed by this wallet, and sends it through Jupiter's
     `/execute`.
3. **Every swap is its own wallet prompt.** Nothing is signed automatically.
4. **One failed item doesn't stop the others.** Declining in the wallet stops
   the run.
5. **Each item shows its status** with a Solscan link. The summary says what
   was and wasn't bought, with **Retry** for the rest.
6. **A lost `/execute` call** leaves the item "executing" until it's looked up
   on-chain, as in Invest. If its outcome can't be learned, the item is
   flagged and can't be retried, because retrying could buy twice.

## History

Chats (`agent_conversations`, now titled from the first question) and bought
plans (`plan_executions` and `plan_execution_items`) are stored per wallet.
`/history` lists both:

- **Bought plans** show per-item status, Solscan links and retry.
- **Chats** link to `/assistant?c=<id>`, which replays the chat with its
  "Data used" panels and plan cards.

The APIs are `GET /api/assistant/executions`,
`GET /api/assistant/conversations` and
`GET /api/assistant/conversations/[id]`. Each is limited to the signed-in
wallet.

## Tests

- **Unit:**
  - `src/server/agent/loop.test.ts`: the loop against a fake streaming client.
    Covers request shape, parallel tool results, plan rejection and
    correction, refusal, fallback content, redaction, JSON retry, API errors
    and truncated tool calls.
  - `src/lib/agent/plan.test.ts`, `src/lib/agent/redact.test.ts` and
    `src/lib/agent/transcript.test.ts`.
  - `src/lib/assistant/review.test.ts` (warnings and pre-flight) and
    `src/lib/assistant/market-hours.test.ts`.
  - `src/server/agent/rate-limit.test.ts`.
- **Integration** (`pnpm test:integration`):
  - `src/app/api/agent/route.integration.test.ts`: SSE with tool results,
    storing, listing and reopening chats, ownership, the disclosure, and
    401/403/503/400/429.
  - `src/server/assistant/executions.integration.test.ts`: buying against the
    real Postgres with real signed transactions. Covers registry-only mints,
    plan checks, partial failure and retry, the signed-order check, re-quote,
    decline, on-chain reconciliation and privacy.

## Not yet verified

- **It hasn't completed a live Claude API call.** The configured key's
  account has no credits: the API answers "Your credit balance is too low",
  which the chat now reports as such. Once the account has credits, try a
  prompt from the suggestions. The request shape is type-checked against
  `@anthropic-ai/sdk` 0.131.0, and the loop is covered by the tests above.
- **No real purchase was made during development.**
  - The plan card and buy flow were driven in a browser with a test wallet
    that signed for real, against faked quote and execution endpoints.
  - The server side is covered by the integration tests.
  - The first real buy should be small.
