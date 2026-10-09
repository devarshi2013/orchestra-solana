# Tokenized stocks

Orchestra lists **every tokenized company stock and ETF that can be bought
through Jupiter on Solana**, across all sectors. We never issue, custody, mint
or redeem them. Three issuers are listed. **Backpack-issued tokens are
excluded**, and Jupiter's `backpack` tag is rejected everywhere.

Researched 2026-10-07 to 2026-10-09 from the issuers' own publications.
Re-check before relying on any of this, especially the eligibility rules.

## Issuers

| Issuer                                                      | Official Solana list (the only place mints come from)                                                                                                                                                    | Published Solana tokens |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **xStocks** (Backed Assets)                                 | Public API `https://api.xstocks.fi/api/v2/public/assets` (paginated; `deployments[].network = "Solana"`), documented at [docs.xstocks.fi](https://docs.xstocks.fi)                                       | 1,272                   |
| **Ondo Global Markets** (Ondo Global Markets (BVI) Limited) | The token CSV linked from [docs.ondo.finance/addresses](https://docs.ondo.finance/addresses) ("Solana Deployed Address" column). Program `XzTT4XB8m7sLD2xi6snefSasaswsKCxx5Tifjondogm`. USDon is skipped | 450                     |
| **PreStocks**                                               | The product data embedded in [prestocks.com/products](https://prestocks.com/products) (each product's `splMint`; all start with the vanity prefix `Pre`)                                                 | 10 (8 still pre-IPO)    |

### Issuers checked and not listed

| Issuer                                             | Why not                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Backpack**                                       | Excluded by product decision                                                                                          |
| **Securitize** (tokenized stocks)                  | Trades only on Securitize's own platform (launched 2026-10-08), not through Jupiter                                   |
| **Superstate** (Opening Bell)                      | Permissioned: only allowlisted, KYC'd wallets can hold the tokens, so an arbitrary wallet can't buy them on Jupiter   |
| **Dinari** (dShares)                               | Solana support is "launching soon"; no Solana mints published                                                         |
| **Remora Markets** (rStocks)                       | Run by Step Finance, which ceased operations on 2026-02-24; the site no longer resolves                               |
| PreStocks SpaceX ("Post-IPO") and xAI ("Acquired") | Marked on PreStocks' page as no longer pre-IPO; holders are told to convert out, so they're excluded with that reason |

Spot checks against independent sources:

- AAPLx `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` and NVDAx
  `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` match the
  [Solana Foundation xStocks case study](https://solana.com/news/case-study-xstocks).
- NVDAon `gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo` matches its
  on-chain metadata ("NVIDIA (Ondo Tokenized)").

## The registry and how it's synced

`src/lib/stocks/registry.generated.json` is the **only source of mint
addresses** in Orchestra. The AI never supplies one: its tools take tickers or
token symbols, resolve them against the registry, and never return mints.

`scripts/sync-stocks.ts` builds it (pure logic in `src/lib/stocks/sync-core.ts`):

1. **Official lists.** Pulls each issuer's list above. Nothing else may add a
   mint (no third-party token lists). If one issuer's source is down, that
   issuer's previously synced entries are kept.
2. **Jupiter verification.** Every mint is looked up in Jupiter's Tokens API
   (`tokens/v2/search`, 100 per call). Excluded with a logged reason if it's
   unknown to Jupiter, not verified, its symbol differs from the issuer's,
   flagged as suspicious, or tagged `backpack`.
3. **Test quote.** A 100 USDC → token `/order` quote (no wallet) must return a
   route. Its price impact sets the **liquidity tier**:

   | Tier   | Price impact of the 100 USDC test quote |
   | ------ | --------------------------------------- |
   | high   | ≤ 0.25%                                 |
   | medium | ≤ 1%                                    |
   | low    | ≤ 10%                                   |
   | —      | above 10%, or no route: excluded        |

4. **Sector and industry**, using the standard sectors (Technology,
   Communication Services, Consumer Discretionary, Consumer Staples,
   Financials, Health Care, Industrials, Energy, Materials, Utilities, Real
   Estate) plus **Diversified** (broad-market ETFs) and **Unclassified**:
   - Financial Modeling Prep's profile when `MARKET_DATA_API_KEY` is set;
     otherwise Nasdaq's public stock screener (sector and industry for about
     7,000 US listings), mapped to the standard names. A few well-known
     classifications are corrected to GICS (e.g. GOOGL and META →
     Communication Services, AMZN and TSLA → Consumer Discretionary, V and MA →
     Financials).
   - ETFs: from the fund's name (e.g. "Energy Select Sector" → Energy).
   - PreStocks: from the issuer's own industry text.
5. **Output.** Each entry is `{ ticker, companyName, type: "stock" | "etf",
sector, industry, mint, issuer, liquidityTier }` plus the token symbol,
   decimals, trading hours, `preIpo` and the measured impact.
   `src/lib/stocks/sync-report.json` lists every exclusion with its reason.

**When it runs.**

- `pnpm sync:stocks`: a full sync. It test-quotes every verified token, paced
  at Jupiter's free-plan rate of 1 request/second (about 30 minutes for about
  1,700 tokens).
- `pnpm build` runs `pnpm sync:stocks --refresh` first. It re-pulls and
  re-verifies all official lists and re-quotes the listed stocks only (a few
  minutes), so tiers stay fresh and delisted tokens drop out. A refresh keeps
  a listed stock through a transient quote failure (RFQ routes come and go
  outside US hours). Newly published tokens are picked up by the next full
  sync.
- **Run the full sync during US market hours** (9:30–16:00 ET, weekdays).
  Most xStocks have no DEX pool and trade only through RFQ market makers, who
  quote during market hours; outside them they answer "Quote not available
  from market maker" and the token is excluded. The script warns when markets
  are closed.
- The sync never fails the build. Without `JUPITER_API_KEY`, or when Jupiter is
  unreachable, it keeps the committed registry. `SYNC_STOCKS=skip` skips it.

**Same company, several issuers.** All issuers' tokens are kept (NVDAx,
NVDAon). A plan item names the company ticker; at purchase time every issuer's
token is quoted for the same USDC amount, and the route with the lowest total
cost (|price impact| + Jupiter fee) is bought (`src/lib/stocks/best.ts`). Token
amounts and per-token prices aren't compared, because each issuer's token can
represent a different fraction of a share. A token symbol (NVDAx) pins that
issuer.

## Backing model

- **PreStocks:** exposure to **private, pre-IPO companies** (OpenAI,
  Anthropic and others). The tokens are Reg S **debt instruments** that give
  economic exposure through special-purpose vehicles (SPVs) holding interests
  in the companies; PreStocks describes them as "1:1 backed by SPV exposure".
  Holders don't own shares. Some of the companies themselves (Anthropic,
  OpenAI) have publicly warned that unauthorized SPV interests in their equity
  may be invalid or worthless. After an IPO or acquisition, holders are told to
  convert out.

- **Ondo:** "fully backed with the underlying asset (together with any cash in
  transit)" and **overcollateralized**.
  - Issued by a bankruptcy-remote SPV with an independent director, with
    assets segregated from Ondo Finance and the Ondo Foundation.
  - Ankura Trust Company holds a first-priority security interest and
    publishes **daily attestations**.
  - Shares are held with US-registered broker-dealers.
  - The tokens are **total-return trackers**: dividends are reinvested, so one
    token is not always one share.
  - Sources: [Overview](https://docs.ondo.finance/ondo-stocks/overview),
    [Trust & Transparency](https://docs.ondo.finance/ondo-stocks/trust-and-transparency).
- **xStocks:** Swiss-law **tracker certificates**, issued by Backed Assets and
  collateralized 1:1 asset-by-asset with the underlying share held by
  regulated custodians.
  - Proof of reserves is published per asset (`/public/proof-of-reserves` on
    the same API, and [defi.xstocks.fi](https://defi.xstocks.fi)).
  - Legal documents: [assets.backed.fi/legal-documentation](https://assets.backed.fi/legal-documentation).

## Token standard on Solana

All three issuers use **SPL Token-2022**: every listed mint reports the
Token-2022 program (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`). On-chain
extensions, checked on AAPLx and NVDAon:

| Extension                  | xStocks                      | Ondo                         | What it means for us                                                                                          |
| -------------------------- | ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `transferHook`             | yes, **no hook program set** | yes, **no hook program set** | No hook runs today. The issuer could set one later, which may break routing.                                  |
| `pausableConfig`           | yes                          | yes                          | **The issuer can pause the token: all transfers and swaps fail while paused.**                                |
| `permanentDelegate`        | yes                          | no                           | Backed can move or burn tokens in any account (compliance and recovery).                                      |
| `scaledUiAmountConfig`     | yes                          | yes                          | A display multiplier for dividends and splits (about 1.002–1.003 now). The raw on-chain amount never changes. |
| `defaultAccountState`      | initialized                  | initialized                  | New token accounts aren't frozen, so swaps can create them freely.                                            |
| `confidentialTransferMint` | yes (auto-approve off)       | yes                          | Not used by swaps.                                                                                            |
| Freeze / mint authority    | set                          | set                          | The issuer can freeze individual accounts and mint.                                                           |

**Multiplier ("scaled UI amount").** xStocks' own guidance
([Dividends & Stock Splits](https://docs.xstocks.fi/developers/multipliers)):
display amount = raw amount × multiplier, while transactions always use the
**raw** amount. Ondo uses the same display multiplier on Solana.

## Eligibility and restrictions

Orchestra doesn't check users' eligibility. The assistant's disclosure and these docs
state the rules; complying with them is the user's responsibility. Get legal
advice before offering these tokens to anyone.

- **United States: prohibited by all three issuers.**
  - Ondo prohibits people in the US and "U.S. persons" (Regulation S), along
    with Canada, Afghanistan, Belarus, Cuba, North Korea, Iran, Libya,
    Myanmar, Russia, Somalia, South Sudan, Sudan, Syria and occupied regions of
    Ukraine ([Eligibility](https://docs.ondo.finance/ondo-stocks/eligibility)).
  - xStocks "may not be offered, sold or delivered within the United States to,
    or for the account or benefit of U.S. Persons"
    ([legal documentation](https://assets.backed.fi/legal-documentation)).
  - PreStocks are Regulation S instruments, not offered to US persons.
- **PreStocks** also excludes Singapore, the European Union and sanctioned
  jurisdictions.
- **United Kingdom.** xStocks are "NOT available for UK Clients". Ondo allows
  only UK professional clients or qualified investors.
- **Professional or qualified investors only.** Ondo restricts these places to
  qualified, professional, accredited or sophisticated investors (with
  financial thresholds): Brazil, the EEA, Hong Kong, Malaysia, Singapore,
  Switzerland (no individuals) and the UK. Backed's legal page describes
  buyers, including **secondary-market** buyers, as needing qualified or
  professional investor status.
- **Australia: not addressed by any issuer's documentation (as of
  2026-10-09).** It isn't in Ondo's prohibited or restricted lists, Backed's
  legal page doesn't mention it, and it isn't on PreStocks' excluded list. Ondo has signed only an exploratory MOU with
  Openmarkets about Australian distribution; nothing has launched. In Australia
  these may be financial products regulated by ASIC. **Treat Australian
  availability as unconfirmed.**
- **Secondary-market buyers:** Ondo deems anyone acquiring tokens on a DEX to
  represent that they are not a prohibited person
  ([Secondary Market Restrictions](https://docs.ondo.finance/ondo-stocks/secondary-market-restrictions)).
  Redemption requires KYC with the issuer.

## Trading hours

- **On-chain DEX pools trade 24/7.** But the issuers' market makers, who
  provide most liquidity and mint and redeem, follow US market hours. Outside
  those hours, expect wider spreads, price gaps at the open, and RFQ routes
  that simply disappear.
- **Ondo:** 24/5, Sunday 8:05pm to Friday 7:59pm ET, in pre-market, core,
  post-market and overnight sessions with short pauses between them. It is
  closed on NYSE holidays. About 30 assets (AAPLon, NVDAon, SPYon, TSLAon and
  others) also trade in an **Off-Hours** session over weekends and holidays,
  with lower limits
  ([Market Hours](https://docs.ondo.finance/ondo-stocks/market-hours-and-trading-availability),
  [Off-Hours](https://docs.ondo.finance/ondo-stocks/off-hours-trading)).
- **xStocks:** `tradingHoursMode` per asset: 977 are `TwentyFourFive`, 294 are
  "Market hours" or "Regular". Backed recommends pausing interactions for
  about 15 minutes around each multiplier update (00:30 UTC after an ex-date).
- **PreStocks:** on-chain only (24/7); there's no public market to be closed.
- The registry stores each token's hours. The plan card warns outside US
  market hours, except for pre-IPO tokens.

## What can block swaps

| Issue                                             | Effect                                        | How Orchestra handles it                                                                                                                                                                   |
| ------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Issuer pause** (`pausableConfig`)               | Every transfer and swap fails                 | Test quote or `/order` fails; the buy fails with a clear message and can be retried later                                                                                                  |
| **Account freeze** (freeze authority)             | Only the frozen holder can't trade            | The leg fails; nothing else is affected                                                                                                                                                    |
| **RFQ outside market hours** (mainly Ondo)        | Quotes may vanish or widen                    | The plan card shows the item's quote as unavailable; it can't be bought until it quotes                                                                                                    |
| **Trading halt** (corporate actions, risk limits) | No quotes                                     | As above                                                                                                                                                                                   |
| **A transfer hook added later**                   | Routing could break                           | Not active today; the sync's verification and test quotes would surface it                                                                                                                 |
| **Scaled UI multiplier**                          | **Not a swap blocker**, but valuation differs | Orchestra values holdings from raw amounts, so stock positions are valued about 0.2–0.3% below their display amount. Rebalance targets stay proportional; realized prices are per raw unit |
| **Wallet support for Token-2022**                 | Some wallets show raw amounts                 | Not ours to fix; noted for users                                                                                                                                                           |
