# Research assistant

`/assistant` is a chat, for signed-in wallets, that researches Orchestra's
assets with live data and proposes a USDC plan. **It never trades.**

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
`plan` event and shown as a card with no mints.

## Tests

- **Unit:**
  - `src/server/agent/loop.test.ts`: the loop against a fake streaming client.
    Covers request shape, parallel tool results, plan rejection and
    correction, refusal, fallback content, redaction, JSON retry, API errors
    and truncated tool calls.
  - `src/lib/agent/plan.test.ts` and `src/lib/agent/redact.test.ts`.
  - `src/server/agent/rate-limit.test.ts`.
- **Integration** (`pnpm test:integration`):
  `src/app/api/agent/route.integration.test.ts`. Covers SSE, storing and
  continuing conversations, ownership, 401/503/400/429.

## Not yet verified

**It hasn't run against the live Claude API**, because no
`ANTHROPIC_API_KEY` was configured during development. Set it in
`.env.local` and try a prompt from the suggestions. The request shape is
type-checked against `@anthropic-ai/sdk` 0.131.0, and the loop is covered by
the tests above.
