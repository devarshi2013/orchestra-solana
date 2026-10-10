# Home page

The home page (`src/app/page.tsx`) is a marketing page in the site's white,
near-black, gray and navy theme, laid out like a premium financial product site.
Each section is its own component in `src/components/home/`:

| Section                        | Component                                 | Notes                                                                                                                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Announcement bar               | `announcement-bar.tsx`                    | Thin navy strip linking to `/chat`.                                                                                                                                                                                                                                                     |
| Navbar                         | `home-navbar.tsx`                         | Wordmark, Product / How it works / FAQ anchors, "Launch app". Sticky and white; its bottom border appears once you scroll. Replaces the site header on this page (`data-home-page` hides `[data-site-header]`, see `globals.css`).                                                      |
| Hero                           | `hero.tsx`                                | Headline with an italic accent (Geist italic), subtext, a word row that cycles (research · compare · decide · approve · own), "Launch Quill", and a framed field of drifting dithered navy dots (`dither-field.tsx`, the same masks as the footer, `src/components/ui/dither-mask.ts`). |
| Statement                      | `statement.tsx`                           | "Smarter decisions start here".                                                                                                                                                                                                                                                         |
| Feature rows (`#how-it-works`) | `feature-rows.tsx`, `feature-visuals.tsx` | Quill Research™, Search™ and Approve™: text on one side and an SVG graphic on the other, swapping sides.                                                                                                                                                                                |
| Feature grid (`#product`)      | `feature-grid.tsx`                        | Four bordered cards in a 3-column bento grid, each with a small abstract graphic; they lift on hover.                                                                                                                                                                                   |
| FAQ (`#faq`)                   | `faq.tsx`                                 | Native `<details>` questions (custody, what you can buy, eligibility, cost, not advice).                                                                                                                                                                                                |
| Email signup                   | `src/components/subscribe-box.tsx`        | Posts to `/api/subscribe` (Resend).                                                                                                                                                                                                                                                     |

Below them sits a gray "Research only. Not financial advice." line, then the
site-wide `DitheredFooter`.

**Rules for this page:** no tokens, tickers, prices, charts, chat examples or
market data, and no market data API calls (checked in the browser: the page
makes none). No made-up logos, testimonials or stats. All graphics are drawn in
code (SVG or CSS masks) and follow the theme in dark mode.

**Motion:** sections fade and slide up as they scroll into view (`Reveal`), the
hero's word row cycles every 2.2 s with a sliding underline, the dot fields
drift slowly. Under `prefers-reduced-motion` the words don't cycle and the dots
stand still.

The previous live market dashboard (hero chart and market cards, built on
Liveline) was removed with this redesign. Its API routes
(`/api/market/prices`, `/tokens`, `/history`) are still there but no page calls
them; `/api/market/compare` is still used by the chat's comparison tables.
