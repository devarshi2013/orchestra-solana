# Home page

The home page (`src/app/page.tsx`) uses the site-wide dark theme and fonts
(see the README's Brand section). It renders the site navbar itself, under its
announcement bar (`data-home-page` hides the layout's copy).

**Palette:** page `#07090D`, surfaces `#0D1117` / `#121821`, borders white at
8%, text `#F5F7FA` (18.6:1) and `#A3ACB9` (8.7:1), navy `#0F1B2D`, glow blues
`#1E3A8A` / `#3B5BDB` (graphics only, never text), silver `#C9D0D7`, and
`#8FA4FF` for the small blue labels (8.5:1). Gradients appear only in graphics
and headline accents, never behind body text.

Each section is its own component in `src/components/home/`:

| Section                                                                                                                                                                                                                                                                                                                                           | Component                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Announcement bar, with a blue gradient line under it                                                                                                                                                                                                                                                                                              | `announcement-bar.tsx`                    |
| Navbar (the site-wide one): Q mark + "Quill", Markets, Research, Product / How it works / FAQ, "Launch app"                                                                                                                                                                                                                                       | `src/components/layout/site-navbar.tsx`   |
| Hero: pill label, two-line headline with "_Quill_" in a silver-to-blue gradient, subtext, a step word that slides vertically (Search → Research → Approve → Trade), "Start trading" (→ `/markets`) and "Research with Quill" (→ `/chat`), and slowly turning rings with a feather curve below the text; drifting orbs and a faded dot grid behind | `hero.tsx`                                |
| Statement: "Clarity is the best edge."                                                                                                                                                                                                                                                                                                            | `statement.tsx`                           |
| How Quill works (`#how-it-works`): "From question to trade", a scroll-driven walkthrough of one trade (see below)                                                                                                                                                                                                                                 | `how-quill-works.tsx`, `story/`           |
| Feature rows (`#features`): Research, Search, Trade, each with a blue label and a gradient graphic, swapping sides                                                                                                                                                                                                                                | `feature-rows.tsx`, `feature-visuals.tsx` |
| "Built for investors" (`#product`): a tinted band with a bento of live tiles (see below)                                                                                                                                                                                                                                                          | `bento-grid.tsx`, `investors/`            |
| FAQ (`#faq`)                                                                                                                                                                                                                                                                                                                                      | `faq.tsx`                                 |
| Email signup (Resend, `/api/subscribe`)                                                                                                                                                                                                                                                                                                           | `src/components/subscribe-box.tsx`        |
| Final call to action: navy-to-black panel with a glowing orb in a corner                                                                                                                                                                                                                                                                          | `final-cta.tsx`                           |

Shared effects (orbs, faded grid, gradient-bordered card with a hover glow,
grain, SVG gradients) are in `effects.tsx`. Then a gray "Research only. Not
financial advice." line and the site-wide `DitheredFooter`, here in dark with
blue (`#3B5BDB`) dots.

## "From question to trade" walkthrough

`src/components/home/story/`: a sticky scroll story (`scroll-story.tsx`). A
rail of five steps on the left (a 1/5 … 5/5 progress bar on phones, with the
step's copy under the frame) and one device frame on the right (an app window
on desktop, a phone on small screens) whose screen changes as you scroll,
about 70vh a step. The section is tall on purpose (five steps of scrolling).

| Step       | Screen (`story-screens.tsx`)                                                                                                                                        | Data                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Ask      | The chat box types "Put $10 each into the top 3 tech stocks".                                                                                                       | None                                                                                                                                             |
| 2 Research | The reply streams in, then "Data used" chips and a ranked table: logo, ticker, market-cap bar, 1Y return.                                                           | `/api/markets/research-top` (FMP when configured, else Jupiter on-chain market cap and "—" for 1Y return)                                        |
| 3 Quote    | A plan card with, per stock, 10 USDC → tokens out, a price-impact meter, the fee and the route's venues.                                                            | Real Jupiter `/order` quotes with no taker (`/api/markets/example-quote?ticker=`, cached 30 s; only the ranked and example tickers are accepted) |
| 4 Approve  | A wallet pop-up over the plan: "Approve swap? 10 USDC → x SYMBOL", Reject / Approve (pulsing). Labelled "Demo, no transaction is sent"; the buttons aren't buttons. | The first item's real quote                                                                                                                      |
| 5 Own      | Three green checks one by one, then "Your holdings" with each token's live value, and a greyed "View on Solscan (demo, not a link)". Labelled "Demo".               | Quote's tokens out × live price from the page's shared poll                                                                                      |

- **Behaviour:** Motion's `useScroll` drives the active step and the rail's
  line; clicking a step scrolls to it (through Lenis, `src/lib/smooth-scroll.ts`);
  after 6 s without scrolling while the section is on screen the steps advance
  by themselves every few seconds, paused on hover. Only transform and opacity
  animate.
- **Reduced motion:** no sticky scrolling or typing: the five screens are a
  static row you scroll sideways, each in its final state.
- **Accessibility:** the rail is a list of buttons with `aria-current="step"`;
  every screen has a text description read politely as the step changes; the
  mock UI inside the frame is hidden from assistive tech.

## Research / Search / Trade cards

The three feature rows' graphics are live visuals (`src/components/home/feature-visuals/`),
each in the same 5:4 box the old graphics used (`visual-frame.tsx`), so the
cards keep their size. Animations start when a card scrolls into view, pause
off screen, and show their final state under reduced motion.

| Card     | Component             | What it shows                                                                                                                                                                                                                                                | Source                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Research | `research-visual.tsx` | "Top 3 tech by market cap?" types out, then the three largest technology stocks appear: rank, logo, ticker, a proportional market-cap bar, 1Y return, a 30-day sparkline. "Data used" chips highlight their column; hovering a row shows P/E and 24h change. | `/api/markets/research-top` (cached 15 min): companies' market caps, 1Y return and P/E from FMP when `MARKET_DATA_API_KEY` is set; otherwise ranked by Jupiter's on-chain market cap, labelled "(on-chain)", with 1Y return and P/E shown as "—". Liquidity from Jupiter Tokens v2. 24h change from the page's shared price poll. Sparkline from GeckoTerminal (`/api/markets/sparklines?window=30d`). |
| Search   | `search-visual.tsx`   | A box that types "nvidia", "healthcare", "energy ETF" in turn (every 4 s) and lists real matches: logo, name, ticker, live price, 24h %. Sector pills with counts. Typing in it searches for real (200 ms debounce); a result opens the details drawer.      | Registry rows and prices from the shared provider (`/api/markets/overview`, `/api/markets/prices`); counts from the registry.                                                                                                                                                                                                                                                                          |
| Trade    | `trade-visual.tsx`    | "10 USDC → x NVDAx" with rate, fee, the route's venues, a low / medium / high price-impact meter, a looping "Quote → Sign in wallet → Confirmed" strip labelled as a demo, and a 30 s countdown ring; each refresh moves to the next of NVDA, TSLA, AAPL.    | A real Jupiter Swap v2 `/order` quote with no taker (`/api/markets/example-quote?i=`, cached 30 s per stock); the route nodes are the quote's own `routePlan` (or its router when it lists none). Rate = USDC in ÷ tokens out.                                                                                                                                                                         |

The cards register their tickers with the page's one price poll (`useWatch`);
none of them polls prices itself.

## "Built for investors" bento

`bento-grid.tsx` holds the heading and the tinted band; `investors/investor-bento.tsx`
lays out the tiles and `investors/tiles.tsx` draws them. Desktop: the dial is the
large tile with two tiles stacked beside it; tablets: two columns; phones: one
column, dial first. Every number is live and carries a "Live · as of" stamp.

| Tile                                | Numbers                                                         | Source                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Open when Wall Street isn't (large) | New York time, session arc, time to the next open or close      | The visitor's clock through `usMarketClock` (`src/lib/assistant/market-hours.ts`; weekends only, no holiday calendar)             |
|                                     | "421 of 430 listed tokens trade 24/5"                           | `totals.hours` and `totals.tokens` from `/api/markets/overview` (the trading hours recorded for each token in the stock registry) |
| Start with $10 (medium)             | Fraction of NVDA, TSLA and AAPL an amount buys, and each price  | The home price poll (Jupiter Price v3); the $10 floor is `MIN_ORDER_USD`                                                          |
| Settles in seconds (small)          | Transactions per second now, and the last 20 one-minute samples | `/api/network` (Solana RPC `getRecentPerformanceSamples`, cached 30 s)                                                            |
| See the gap before you buy (medium) | Token price against the stock's last US price                   | `/api/markets/extras` (Jupiter price against FMP)                                                                                 |
| Your money, your currency (small)   | AUD to USDC and what it buys                                    | `/api/markets/extras` (FMP AUD/USD rate) and the price poll                                                                       |

The last two need `MARKET_DATA_API_KEY`. Without it (or when the source fails)
`/api/markets/extras` returns nulls and those tiles are left out; nothing is
faked. The throughput counter counts up once; under reduced motion it shows the
value straight away. The slider and the converter are plain inputs, so they
work from the keyboard, and results are announced with `aria-live="polite"`.

## Live sections

Slotted between the existing sections (nothing existing moved): the ticker
tape, live quote and stats bar follow the hero; the markets table, sector
heatmap and trust section follow the bento grid. They live in
`src/components/home/live/` and share one provider (`home-market.tsx`).

| Section                    | Component            | What it shows                                                                                                                                                                                                                                                                                                  |
| -------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticker tape                | `ticker-tape.tsx`    | The 12 largest priced stocks plus SOL and JUP: live price and 24h % with ▲/▼ and +/−. Pauses on hover or focus; a still, scrollable row under reduced motion.                                                                                                                                                  |
| Live quote                 | `live-quote.tsx`     | An example question answered with a real Jupiter `/order` quote (10 USDC → NVDAx, no taker, so nothing can be signed), refreshed every 30 s. Labelled "Live quote, not a trade".                                                                                                                               |
| Stats bar                  | `stats-bar.tsx`      | Verified stocks, sectors, issuers, combined 24h volume.                                                                                                                                                                                                                                                        |
| Markets table (`#markets`) | `home-markets.tsx`   | Tabs Stocks / ETFs / Crypto / Top gainers / Top losers; Asset, Price, 24h %, 24h volume, Market cap, 7-day sparkline; sortable; 10 rows; "View all" → `/markets`; a row opens a drawer with its details and a link to its stock page. The US market hours badge (`market-hours-badge.tsx`) sits in its header. |
| Sector heatmap             | `sector-heatmap.tsx` | A tile per sector coloured by the average 24h change; clicking one filters the table.                                                                                                                                                                                                                          |
| Trust                      | `trust.tsx`          | The verified-stock count, a link to `/registry` (every mint with a Solscan link, issuer and last-verified date), and notes on custody and sourcing.                                                                                                                                                            |

**Every number and its source**

| Number                                                | Source                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tape, table and drawer prices and 24h %               | Jupiter Price v3 (`/api/markets/prices`, one batched request every 12 s for the whole page), starting from Jupiter Tokens v2 (`/api/markets/overview`) |
| 24h volume, market cap (on-chain), holders, liquidity | Jupiter Tokens v2 (`/api/markets/overview`, cached 60 s)                                                                                               |
| 7-day sparklines                                      | GeckoTerminal hourly candles (`/api/markets/sparklines?window=7d`, cached 5 min)                                                                       |
| Example quote: tokens out, price impact, fee          | Jupiter Swap v2 `/order` without a taker (`/api/markets/example-quote`, cached 30 s)                                                                   |
| Verified stocks, sectors, issuers                     | Counted from the registry (`src/lib/stocks/registry.generated.json`)                                                                                   |
| Combined 24h volume                                   | Sum of Jupiter's 24h buy + sell volume over the listed stock tokens that report one (the bar says how many); dropped when none do                      |
| Sector averages                                       | Mean of the 24h changes of the sector's stocks that have one (each tile says how many of how many)                                                     |
| Last verified date                                    | The registry's `syncedAt`                                                                                                                              |
| US market status                                      | The browser's clock in US Eastern time against regular hours and the holiday list (`src/lib/assistant/market-hours.ts`)                                |

**Data rules:** every live block shows "● Live · as of HH:MM"; loading shows
skeletons; a failed read shows "Data unavailable", never a made-up value. The
overview is re-read every 60 s and prices every 12 s, both paused while the tab
is hidden. No user counts, testimonials or invented stats. The page's existing
buttons are unchanged and the live sections add no chat buttons.

**Motion:** orbs drift, the hero rings turn (90 s a turn), the step word
slides every 2.2 s, sections fade in on scroll, cards lift and glow on hover.
Under `prefers-reduced-motion` none of it moves. On phones the second orb and
the feather's glow are left out.

**Logo:** the Q mark (`src/components/brand/quill-mark.tsx`), used across the whole site (see the README).

## Fonts, scrolling and hover effects

- **Fonts:** the site-wide set (`src/app/fonts.ts`): Sora headings, Instrument
  Serif Italic accents, Manrope text, Geist Mono labels and numbers.
- **No dividers:** sections share the `#07090D` background and are separated
  by spacing; glows cross section edges (the page wrapper clips sideways
  overflow). The navbar's border shows only once scrolled; the footer has no top
  border.
- **Smooth scrolling:** Lenis (`src/components/layout/smooth-scroll.tsx`, site-wide, about 1.1 s,
  anchor links glide to their section). Off under reduced motion, where native
  scrolling (with `scroll-behavior: smooth` as a fallback) applies.
- **Performance:** only transform and opacity animate on scroll; orbs keep a
  fixed blur and drift with transform; looping animations pause off screen
  (`PauseOffscreen`); scroll-in animations run once (IntersectionObserver via
  `Reveal`); the grain is left out on phones.
- **Hover effects (mouse only, `hover-text.tsx` + `globals.css`):** headline
  words lift and brighten; gradient accents sweep; the statement spreads and
  glows; row labels turn silver with an arrow and headlines get a growing
  underline; steps grow and light the line
  up to them; nav links get a centre-out underline; footer links lift; buttons
  get a light sweep. Movement is dropped under reduced motion.
