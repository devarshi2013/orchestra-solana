# Invest: live symphonies on the user's wallet

There is no contract and no custody. A live symphony is a database record:
`investments` holds `{ owner, symphony snapshot, rebalance rule, drift
threshold, holdings snapshot }`. Its portfolio is the owner's **wallet
balances** of the symphony's mints plus USDC. Every swap is a Jupiter Swap v2
order that the owner's wallet signs (`signTransaction`, never sends). Our
server then lands it through `/execute` (see [jupiter-api.md](./jupiter-api.md)).

## Who can do what: Sign-In With Solana

Investment records are keyed by wallet, so the server has to know who is asking:

1. `GET /api/auth/challenge?address=` returns a message ("…does not move funds
   or approve any transaction", with a nonce and a 10-minute expiry). It is
   stored in an HMAC-signed httpOnly cookie.
2. The wallet signs it (`signMessage`). `POST /api/auth/verify` checks the
   ed25519 signature with Node's crypto and sets a 7-day session cookie
   (`SESSION_SECRET`, required in production).

Every invest API checks that the session wallet owns the record. Anything else
returns 404.

## Rebalance flow

`src/server/invest/service.ts`, with the pure parts in `src/lib/invest/`.

1. **Snapshot:** read balances over RPC (`getBalance` plus
   `getParsedTokenAccountsByOwner` for SPL and Token-2022), spot prices from
   Price API v3, and the target from `evaluate()` on the latest stored daily
   close.
2. **Plan** (`planRebalance`): compute the difference between current and
   target weights.
   - All trades go through USDC: sell X → USDC, USDC → Y.
   - Skipped legs:
     - below **$10** (Jupiter documents no minimum except about $10 for
       gasless orders; under that, fees eat the trade anyway);
     - within the user's **drift threshold**;
     - mints without a live price (their weight stays in USDC).
   - Exits sell the whole position, so no dust is left behind.
   - **0.02 SOL** stays in the wallet for fees and rent. That also means
     Jupiter never needs gasless mode, whose minimum is higher.
3. **Review:** a run with its legs is saved (`rebalance_runs` and
   `rebalance_legs`; sells first, then buys). The review screen shows
   indicative quotes (expected output, price impact, fee, router) at the
   planned sizes.
4. **Execute, one leg at a time** (browser: `use-rebalance-execution.ts`):
   - `prepare`: re-read balances and size the leg (`sizeLeg`). Sells never
     exceed what's held. Buys share the USDC the sells actually produced, pro
     rata. Then fetch a fresh `/order` with `taker` = owner.
   - The wallet signs it. If the quote expired while the prompt was open, the
     leg is re-quoted (up to 3 times).
   - `execute`: the server checks that the signed transaction's message is
     **byte-for-byte the quoted order** and that the owner's signature
     verifies. It records the leg as `executing` (with the signature when the
     owner pays fees), calls `/execute`, and records `totalInputAmount`,
     `totalOutputAmount`, the realized price and the signature.
5. **Complete:** when every leg has succeeded or been skipped, the holdings
   snapshot, `lastRebalancedAt` and `nextDueAt` are saved, and that
   investment's notices are cleared.

### Partial failures and resume

Legs run strictly in order. A buy can't be prepared until every earlier leg
has succeeded or been skipped. A failure stops the run in a `partial` state;
completed legs stay recorded.

| Situation                                                 | Leg becomes                | Resume does                                               |
| --------------------------------------------------------- | -------------------------- | --------------------------------------------------------- |
| Wallet prompt declined                                    | `failed` (reason kept)     | Retries the leg with a fresh quote                        |
| Quote expired before landing                              | `pending`                  | Re-quotes automatically                                   |
| Jupiter says it failed (didn't land, slippage…)           | `failed`                   | Retries, re-sized from live balances                      |
| Our `/execute` call died mid-flight                       | stays `executing`          | After 60 s it is looked up on-chain and recorded (below)  |
| Mid-flight with no known signature (RFQ: maker pays fees) | `failed`, `outcomeUnknown` | Blocked: "start a fresh rebalance" re-plans from balances |

**Reconciliation** (`reconcileRun`, run on every read of a run): a leg with a
signature is looked up with `getParsedTransaction`.

- If it landed, the amounts come from the owner's pre/post token balances
  (native SOL from lamports, which include the network fee).
- If it failed on-chain, it's marked failed.
- If it's still missing after 3 minutes, the blockhash has expired, so it
  never landed and is safe to retry.

Without a signature we can't look the transaction up. Retrying could trade
twice, so the run must be re-planned instead.

An untouched `planned` run older than 10 minutes is cancelled when the page
reopens, so a stale plan is never executed.

## Notifications

`GET /api/cron/rebalances` runs daily at 00:20 UTC (`vercel.json`), after
prices sync at 00:10. For each active investment whose `nextDueAt` has passed:

- **Calendar rules** (daily, weekly on Mondays, monthly on the 1st) notify when
  the plan has trades.
- **Threshold rules** notify only when a holding drifts past the rule's
  threshold.

A notice is an in-app banner (`notifications` table; partial runs also show a
"Resume" banner). It is also sent by **email** through Resend when
`RESEND_API_KEY` and `EMAIL_FROM` are set (otherwise logged to the console),
and by **web push** when VAPID keys are set (`public/sw.js`). Each notice links
to `/invest/<id>/rebalance`. While a notice is unread, no new one is sent.
**Nothing is ever traded without the owner signing.**

## Environment

| Variable                                                             | Needed for                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| `SESSION_SECRET`                                                     | Sign-in sessions (required in production)               |
| `APP_URL`                                                            | Links in emails and push                                |
| `RESEND_API_KEY`, `EMAIL_FROM`                                       | Rebalance emails (optional)                             |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push (optional; `npx web-push generate-vapid-keys`) |
| `CRON_SECRET`                                                        | `/api/cron/*` in production                             |

## Known limits

- **The whole wallet balance of the symphony's tokens and USDC counts.** USDC
  or SOL held for other purposes is treated as part of the portfolio.
- **Wrapped-SOL token accounts are ignored.** Jupiter spends native SOL.
- **One open rebalance per investment.**
- **A realized price recovered by reconciliation includes the network fee for
  SOL legs**, because native SOL deltas include it.

## Tests

- **Unit:** `src/lib/invest/*.test.ts` covers planning, sizing, schedule and
  run rules. `src/server/solana/signed-order.test.ts` and
  `src/server/auth/session.test.ts` cover the signed-order check and sign-in.
- **Integration** (`pnpm test:integration`, needs the local Postgres):
  `src/server/invest/service.integration.test.ts` runs full rebalances against
  the real database, with the wallet, Jupiter and RPC faked. It covers
  success, partial then resume, an expired quote, a tampered transaction, a
  lost `/execute` reconciled on-chain, an unknown outcome blocking retries,
  leg ordering and ownership, and due notifications.
