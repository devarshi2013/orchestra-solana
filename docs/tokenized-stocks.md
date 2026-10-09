# Tokenized stocks

Orchestra lists **existing** tokenized stocks and ETFs that trade on Solana
through Jupiter. We never issue, custody, mint or redeem them. Two issuers
are listed. **Backpack-issued tokens are excluded**: they come from neither
source, and Jupiter's `backpack` tag is rejected everywhere.

Researched 2026-10-07 from the issuers' own publications. Re-check before
relying on any of this, especially the eligibility rules.

## Where the mints come from

`pnpm assets:sync-stocks` (`scripts/sync-stock-sources.mjs`) writes
`src/lib/assets/data/stock-sources.json` from:

| Issuer                                                      | Official source                                                                                                                                                                         | Solana tokens        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Ondo Global Markets** (Ondo Global Markets (BVI) Limited) | The token CSV linked from [docs.ondo.finance/addresses](https://docs.ondo.finance/addresses) ("Solana Deployed Address" column). Program `XzTT4XB8m7sLD2xi6snefSasaswsKCxx5Tifjondogm`. | 450 (USDon excluded) |
| **xStocks** (Backed Assets)                                 | The public API `https://api.xstocks.fi/api/v2/public/assets` (`deployments[].network = "Solana"`), documented at [docs.xstocks.fi](https://docs.xstocks.fi)                             | 1,272                |

The two issuers often cover the same underlying (AAPLx and AAPLon). Each is
listed separately under its own mint. Every mint is then verified against
Jupiter's Tokens API at server start (see [assets.md](./assets.md)). As of
2026-10-07, all 1,722 are known to Jupiter. About 22 trade enough to list:
xStocks have real DEX pools, while Ondo trades mostly through RFQ market
makers (NVDAon showed $3.9M of 24h volume on a $3k pool).

Spot checks against independent sources:

- AAPLx `XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp` and NVDAx
  `Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh` match the
  [Solana Foundation xStocks case study](https://solana.com/news/case-study-xstocks).
- NVDAon `gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo` matches its
  on-chain metadata ("NVIDIA (Ondo Tokenized)").

## Backing model

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

Both issuers use **SPL Token-2022**. All 1,722 mints report the Token-2022
program. On-chain extensions, checked on AAPLx and NVDAon:

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

Orchestra doesn't check users' eligibility. The `/assets` page and these docs
state the rules; complying with them is the user's responsibility. Get legal
advice before offering these tokens to anyone.

- **United States: prohibited by both issuers.**
  - Ondo prohibits people in the US and "U.S. persons" (Regulation S), along
    with Canada, Afghanistan, Belarus, Cuba, North Korea, Iran, Libya,
    Myanmar, Russia, Somalia, South Sudan, Sudan, Syria and occupied regions of
    Ukraine ([Eligibility](https://docs.ondo.finance/ondo-stocks/eligibility)).
  - xStocks "may not be offered, sold or delivered within the United States to,
    or for the account or benefit of U.S. Persons"
    ([legal documentation](https://assets.backed.fi/legal-documentation)).
- **United Kingdom.** xStocks are "NOT available for UK Clients". Ondo allows
  only UK professional clients or qualified investors.
- **Professional or qualified investors only.** Ondo restricts these places to
  qualified, professional, accredited or sophisticated investors (with
  financial thresholds): Brazil, the EEA, Hong Kong, Malaysia, Singapore,
  Switzerland (no individuals) and the UK. Backed's legal page describes
  buyers, including **secondary-market** buyers, as needing qualified or
  professional investor status.
- **Australia: not addressed by either issuer's documentation (as of
  2026-10-07).** It isn't in Ondo's prohibited or restricted lists, and Backed's
  legal page doesn't mention it. Ondo has signed only an exploratory MOU with
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
- The registry stores each asset's hours (`24/5` or `Market hours`). `/assets`
  shows them.

## What can block swaps

| Issue                                             | Effect                                        | How Orchestra handles it                                                                                                                                                                   |
| ------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Issuer pause** (`pausableConfig`)               | Every transfer and swap fails                 | Test quote or `/order` fails; the buy fails with a clear message and can be retried later                                                                                                  |
| **Account freeze** (freeze authority)             | Only the frozen holder can't trade            | The leg fails; nothing else is affected                                                                                                                                                    |
| **RFQ outside market hours** (mainly Ondo)        | Quotes may vanish or widen                    | The test quote on `/assets` warns; rebalances skip legs Jupiter can't quote                                                                                                                |
| **Trading halt** (corporate actions, risk limits) | No quotes                                     | As above                                                                                                                                                                                   |
| **A transfer hook added later**                   | Routing could break                           | Not active today; the startup verification and test quotes would surface it                                                                                                                |
| **Scaled UI multiplier**                          | **Not a swap blocker**, but valuation differs | Orchestra values holdings from raw amounts, so stock positions are valued about 0.2–0.3% below their display amount. Rebalance targets stay proportional; realized prices are per raw unit |
| **Wallet support for Token-2022**                 | Some wallets show raw amounts                 | Not ours to fix; noted for users                                                                                                                                                           |
