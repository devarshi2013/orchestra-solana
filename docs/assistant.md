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

## Chat history

A ChatGPT-style sidebar (`src/components/assistant/chat-sidebar.tsx`; a drawer under 768px), with the app shell in `assistant-chat.tsx`. The chat app is in `src/app/chat/layout.tsx` and renders in the browser only, since everything it shows comes from there.

- **URLs:** each chat is `/chat/[id]`; `/chat` is a new chat, and `/assistant` (with its `?q=` pre-fill) redirects to it. Switching chats uses `history.pushState`, so refresh, back/forward and bookmarks work. The URL decides what's on screen: a saved chat is shown from storage and becomes the live conversation when you send a message in it. A reply still streaming when you leave its chat keeps going and is saved.
- **Storage** (`src/lib/assistant/chat-history.ts`): localStorage, one list per wallet (`askfirst.chats.v1.<wallet>`) and a `guest` list before a wallet connects. Every read and write is wrapped; if storage is blocked, chats live in memory for the visit. Each chat stores its id, title (and where it came from), pinned flag, timestamps, messages, the model-side history, and plans with each purchase's statuses and Solscan signatures. A chat is saved once its first message is sent. At most 200 chats; the oldest unpinned go first, and a full quota drops old chats' model history before whole chats.
- **Guests:** without a wallet the assistant can research (`src/server/agent/guest.ts`): the balance, quote and plan tools answer "connect a wallet". When a wallet connects and guest chats exist, a banner offers to move them to it.
- **Titles:** the first ~40 characters of the first message, then a 3-6 word title from `claude-haiku-4-5` after the first reply (`POST /api/agent/title`, 60 an hour per client). A failure keeps the first title; a name the user chose is never replaced.
- **Sidebar:** "New chat" (Ctrl/Cmd+Shift+O), search over titles and message text, Pinned first then Today / Yesterday / Previous 7 days / Previous 30 days / Older, a "…" menu per chat (hover, or long-press / always shown on touch) to rename inline (Enter saves, Escape cancels), pin or delete (confirmed), a bag icon on chats with a purchase, Up/Down/Home/End to move through chats, a remembered collapse, and "Clear all history" (confirmed) under settings. Rename, pin and delete are announced to screen readers.
- **Old plans:** plan cards in a reopened chat are read-only and offer "Get fresh quote" instead of "Approve" (their quotes have expired); bought items keep their Solscan links.

## How replies render

Replies are GitHub-flavoured Markdown (`src/components/assistant/markdown.tsx`: react-markdown + remark-gfm). Raw HTML from the model is dropped and unsafe link protocols are stripped; links open in a new tab.

- **Tables:** each one sits in its own rounded scroll box, so it never widens the chat on a phone. The header row is sticky, rows are zebra-striped with a hover state. `src/lib/markdown/table-columns.ts` reads each table by column: numeric columns are right-aligned (tabular figures), and change columns (returns, growth, 24h…) get an explicit +/− sign and green/red colour.
- **Text blocks:** the server puts a blank line between the text of separate model calls in a turn. Without it, "Here they are:" and the table after a tool call ran together and the table showed as raw pipes.
- **Streaming:** `src/lib/markdown/streaming.ts` holds back what would flash as raw syntax: a table until its delimiter row arrives (a skeleton shows meanwhile), a row until its line ends, an unmatched `**`, and an unfinished comparison block.
- **Comparison blocks:** for 2+ stocks compared on market cap, 1Y return and P/E, the prompt asks for a fenced `comparison` block of JSON (`src/lib/markdown/comparison.ts`, validated with Zod). It renders as `ComparisonTable`: sortable columns, logos, Jupiter's live price and a 7-day sparkline per row, from `GET /api/market/compare?tickers=` (`src/server/market/compare.ts`). Tickers resolve through the registry only. Every issuer's token is priced and a stock whose tokens disagree by over 5% shows no price, since a thin token's Jupiter price can be far off. Sparklines use the xStocks token's GeckoTerminal history (Ondo tokens trade mostly by RFQ, and their pools record bad prints); isolated bad prints are dropped and a noisy history isn't drawn. Invalid JSON falls back to a plain table.
- **Preview:** in development, `/dev/chat-preview` renders sample replies (`markdown.fixtures.ts`), including half-streamed ones.

## Browse stocks

The **Browse stocks** panel (`src/components/assistant/stock-browser.tsx`, controls in `stock-filters.tsx`, logic in `src/lib/stocks/browse.ts`) lists every registry company from `GET /api/stocks` (no mints). Clicking one asks the assistant about it.

- **Filters** (they combine): search by company or ticker (debounced 200 ms); **Sector** (multi-select with counts, the 11 standard sectors plus Diversified and Unclassified); **Industry** (multi-select, searchable, only within the chosen sectors and disabled until one is chosen); **Type** (All, Stocks, ETFs); **Liquidity** (Any, High, Medium+, from the 100 USDC test quote). Counts apply every other filter.
- **Sort:** Liquidity (default), Market cap, 24h change, 1Y return, Name, with an ascending/descending toggle; missing figures sort last. `GET /api/stocks/metrics` (`src/server/stocks/metrics.ts`) supplies the figures: 24h change live from Jupiter for each company's most liquid token (all issuers' tokens are priced, and a company whose tokens disagree by over 5% gets none); market cap and 1Y return from Financial Modeling Prep's batch endpoints, only when `MARKET_DATA_API_KEY` is set and the plan includes them. A sort without data is shown disabled ("needs market data"), never estimated.
- **Active filters** show as removable chips with "Clear all" (which also resets the sort), plus "Showing N of M stocks". An empty result offers "Clear filters".
- **URL:** the filters live in the query string (`?sector=technology,energy&industry=…&type=etf&liquidity=medium&sort=change&dir=asc&find=…`), so a refresh or a shared link shows the same list; unknown values are ignored, and switching chats keeps them.
- **Phones (<768px):** search plus a "Filters (n)" button opening a bottom sheet with the same dropdowns, applied together with "Apply".

## Disclosure

Before first use, the browser shows a one-time disclosure: AI can be wrong, it's not financial advice, tokenized stocks are securities with eligibility rules. Acceptance is stored in `localStorage` (`src/components/assistant/disclosure-gate.tsx`). Bumping `ASSISTANT_DISCLOSURE_VERSION` asks again.

## Tests

- `src/server/agent/loop.test.ts`: the loop against a fake streaming client.
- `src/lib/assistant/chat-history.test.ts`: create, rename, pin, delete, search, grouping, the 200-chat cap, per-wallet lists, moving guest chats, restoring a chat from its URL, and blocked storage.
- `src/server/agent/guest.test.ts`, `title.test.ts`: guest tools and AI titles.
- `src/lib/stocks/browse.test.ts`: Browse stocks filters combining, industries per sector, sorting, URL round-trip and Clear all.
- `src/components/assistant/markdown.test.tsx`, `src/lib/markdown/*.test.ts`: tables, signs and colours, streamed tables in chunks, comparison blocks and their fallback.
- `src/server/market/compare.test.ts`: registry-only tickers, issuer price cross-check, sparkline bad prints.
- `src/server/agent/tools.test.ts`: stock-only tools and plan rejection.
- `src/app/api/agent/route.test.ts`: SSE, history round-trip, validation, 503, 429.
- `src/lib/agent/plan.test.ts`, `redact.test.ts`, `transcript.test.ts`.
- `src/lib/assistant/review.test.ts`, `market-hours.test.ts`.
- `src/lib/stocks/*.test.ts`: sync verification, liquidity tiers, sector mapping, registry filters, best-issuer selection.
