# Stock assistant

`/chat` is a chat that helps users find **tokenized US stocks on Solana**, shows **live Jupiter quotes**, and buys only after the user **approves each swap in their wallet**. The assistant itself never trades.

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
- **Each item** resolves to a registry company. A ticker (NVDA) leaves the issuer to the buy, which quotes the issuers' tokens one at a time (most liquid first) and takes the first Jupiter can build; a token symbol (NVDAx) pins that issuer.
- **No duplicates** (the same company twice, even via different issuers), and every item is at least $10 (`MIN_ORDER_USD`).
- **The total** equals the items' sum and fits the wallet's live USDC.

Failures go back to the model as an error result. After three, it's told to stop and explain.

## Buying a plan

The plan card (`src/components/assistant/plan-card.tsx`) shows each stock with:

- **its amount**, editable or removable;
- **a fresh Jupiter quote** (shown with its issuer and liquidity badge): tokens out, price impact and fees, from `POST /api/assistant/quote`, server-paced, cached 10 s and asked for 500 ms after typing stops;
- **warnings** (`src/lib/assistant/review.ts`): high price impact, low or thin liquidity, outside US market hours (not for pre-IPO tokens), or no buildable quote.

**Errors people see** (`src/lib/friendly-error.ts`): one short line per item, red with a warning icon, never Jupiter's raw message, a request ID, JSON or an error code. The full error (status, request ID, body) is logged to the server or browser console instead.

| Failure                                        | Message                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| Rate limit (429), after retries                | Prices are busy right now. Retrying in a moment…                               |
| No route / no quote / market maker unavailable | This stock can't be traded right now. Try a smaller amount or try again later. |
| Network error or timeout                       | Connection issue. Check your internet and try again.                           |
| Not enough USDC                                | Not enough USDC for this trade.                                                |
| Not enough SOL for fees                        | Not enough SOL for network fees.                                               |
| Declined in the wallet                         | Transaction cancelled in your wallet.                                          |
| Anything else                                  | Something went wrong. Please try again.                                        |

A company's tokens (BACon, BACx) give one message together. **Rate limits:** the server retries a 429 three times (1 s, 2 s, 4 s) in `jupiterFetch`; for quotes and buy orders the browser does the retrying instead, so the item can show "Retrying…", and a quote still rate-limited is tried again by itself every 15 s (three times). "Refresh quotes" clears the errors and quotes again.

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

## Chat history

A chat history sidebar (`src/components/assistant/chat-sidebar.tsx`; a drawer under 768px), with the app shell in `assistant-chat.tsx`. The chat app is in `src/app/chat/layout.tsx` and renders in the browser only, since everything it shows comes from there.

- **URLs:** each chat is `/chat/[id]`; `/chat` is a new chat, and `/assistant` (with its `?q=` pre-fill) redirects to it. Switching chats uses `history.pushState`, so refresh, back/forward and bookmarks work. The URL decides what's on screen: a saved chat is shown from storage and becomes the live conversation when you send a message in it. A reply still streaming when you leave its chat keeps going and is saved.
- **Storage** (`src/lib/assistant/chat-history.ts`): localStorage, one list per wallet (`askfirst.chats.v1.<wallet>`) and a `guest` list before a wallet connects. Every read and write is wrapped; if storage is blocked, chats live in memory for the visit. Each chat stores its id, title (and where it came from), pinned flag, timestamps, messages, the model-side history, and plans with each purchase's statuses and Solscan signatures. A chat is saved once its first message is sent. At most 200 chats; the oldest unpinned go first, and a full quota drops old chats' model history before whole chats.
- **Guests:** without a wallet the assistant can research (`src/server/agent/guest.ts`): the balance, quote and plan tools answer "connect a wallet". When a wallet connects and guest chats exist, a banner offers to move them to it.
- **Titles:** the first ~40 characters of the first message, then a 3-6 word title from `claude-haiku-4-5` after the first reply (`POST /api/agent/title`, 60 an hour per client). A failure keeps the first title; a name the user chose is never replaced.
- **Sidebar:** "New chat" (Ctrl/Cmd+Shift+O), search over titles and message text, Pinned first then Today / Yesterday / Previous 7 days / Previous 30 days / Older, a "…" menu per chat (hover, or long-press / always shown on touch) to rename inline (Enter saves, Escape cancels), pin or delete (confirmed), a bag icon on chats with a purchase, Up/Down/Home/End to move through chats, a remembered collapse, and "Clear all history" (confirmed) under settings. Rename, pin and delete are announced to screen readers.
- **Old plans:** plan cards in a reopened chat are read-only and offer "Get fresh quote" instead of "Approve" (their quotes have expired); bought items keep their Solscan links.

## How replies render

Replies are GitHub-flavoured Markdown (`src/components/assistant/markdown.tsx`: react-markdown + remark-gfm). Raw HTML from the model is dropped and unsafe link protocols are stripped; links open in a new tab.

- **Tables:** each one sits in its own rounded scroll box, so it never widens the chat on a phone. The header row is sticky with small tracked-out labels, and rows tint on hover (the same table style as the markets page). `src/lib/markdown/table-columns.ts` reads each table by column: numeric columns are right-aligned (tabular figures), and change columns (returns, growth, 24h…) get an explicit +/− sign and green/red colour.
- **Text blocks:** the server puts a blank line between the text of separate model calls in a turn. Without it, "Here they are:" and the table after a tool call ran together and the table showed as raw pipes.
- **Streaming:** `src/lib/markdown/streaming.ts` holds back what would flash as raw syntax: a table until its delimiter row arrives (a skeleton shows meanwhile), a row until its line ends, an unmatched `**`, and an unfinished comparison block.
- **Comparison blocks:** for 2+ stocks compared on market cap, 1Y return and P/E, the prompt asks for a fenced `comparison` block of JSON (`src/lib/markdown/comparison.ts`, validated with Zod). It renders as `ComparisonTable`: sortable columns, logos, Jupiter's live price and a 7-day sparkline per row, from `GET /api/market/compare?tickers=` (`src/server/market/compare.ts`). Tickers resolve through the registry only. Every issuer's token is priced and a stock whose tokens disagree by over 5% shows no price, since a thin token's Jupiter price can be far off. Sparklines use the xStocks token's GeckoTerminal history (Ondo tokens trade mostly by RFQ, and their pools record bad prints); isolated bad prints are dropped and a noisy history isn't drawn. Invalid JSON falls back to a plain table.
- **Preview:** in development, `/dev/chat-preview` renders sample replies (`markdown.fixtures.ts`), including half-streamed ones.

## The Research page's look

`/chat` shares the home and markets pages' tokens, fonts and backdrop
(`src/components/design/`), and adds its own pieces:

- **Navigation:** the navbar button reads "Browse stocks" here and is the only
  link to `/markets` (a CSS switch on the chat's marker in `globals.css`). The
  old Browse stocks panel, its filters and its `/api/stocks` routes are gone.
- **Empty chat** (`research-intro.tsx`): "Research it. _Quote_ it. Own it.",
  one line on what Quill does, the steps Ask → Live quote → You approve, and
  four example questions that send on click. It fades out with the first message.
- **Research notes** (`turn.tsx`): each reply is a note on a thin accent rule:
  "Data used" chips (`data-used.tsx`, one per tool call, opening its input and
  result), a lead sentence in the heading font when the reply opens with a
  plain one, the body, and "Sources: … · as of HH:MM" (sources come from the
  tool calls that succeeded; the time from when the reply finished, absent on
  older saved replies). Your messages are accent pills on the right.
- **Research trail:** while a reply is in progress the note lists the REAL
  tool calls as steps ("Fetching market data: TSLA…"), ticking each as its
  result arrives, then "Writing the note".
- **Trade ticket** (`plan-card.tsx`): a plan is a ticket with a perforated
  divider, one line per stock (ticker, amount in, tokens out, impact, fees), a
  total row and the Approve button. The buying logic is unchanged.
- **Command bar** (`composer.tsx`): a floating bar that glows on focus; Enter
  sends, Shift+Enter adds a line, "/" lists the example questions, the "$"
  pill appends "Budget: N USDC." to the message, and the round button turns
  into Stop while a reply streams (Stop keeps what has arrived).
- **Buttons** (scoped by `data-research` in `globals.css`): primary is solid
  accent blue with an inner highlight, a lift and light sweep on hover and a
  0.98 press; secondary is outlined and fills softly; ghost and icon buttons
  are round with tooltips (`tip.tsx`).
- **Sidebar** (`chat-sidebar.tsx`): a primary "New chat" (its "+" turns on
  hover; Ctrl/Cmd+Shift+O), a search pill with a clear button, an All / Pinned
  / With trades control with a sliding highlight, and the list with an accent
  dot on the open chat.

## Disclosure

Before first use, the browser shows a one-time disclosure: AI can be wrong, it's not financial advice, tokenized stocks are securities with eligibility rules. Acceptance is stored in `localStorage` (`src/components/assistant/disclosure-gate.tsx`). Bumping `ASSISTANT_DISCLOSURE_VERSION` asks again.

## Tests

- `src/server/agent/loop.test.ts`: the loop against a fake streaming client.
- `src/lib/assistant/chat-history.test.ts`: create, rename, pin, delete, search, grouping, the 200-chat cap, per-wallet lists, moving guest chats, restoring a chat from its URL, and blocked storage.
- `src/server/agent/guest.test.ts`, `title.test.ts`: guest tools and AI titles.
- `src/components/assistant/markdown.test.tsx`, `src/lib/markdown/*.test.ts`: tables, signs and colours, streamed tables in chunks, comparison blocks and their fallback.
- `src/server/market/compare.test.ts`: registry-only tickers, issuer price cross-check, sparkline bad prints.
- `src/server/agent/tools.test.ts`: stock-only tools and plan rejection.
- `src/app/api/agent/route.test.ts`: SSE, history round-trip, validation, 503, 429.
- `src/lib/agent/plan.test.ts`, `redact.test.ts`, `transcript.test.ts`.
- `src/lib/assistant/review.test.ts`, `market-hours.test.ts`.
- `src/lib/stocks/*.test.ts`: sync verification, liquidity tiers, sector mapping, registry filters, best-issuer selection.
