# Home page

The home page (`src/app/page.tsx`) is **dark only**, whatever the site theme:
`.home-dark` (in `globals.css`) re-points the theme tokens for the page, and
the footer gets the same tokens on this page (`[data-site-footer]`). The rest of
the site (chat, terms, risk) is unchanged. Its own navbar replaces the site
header here (`data-home-page` hides `[data-site-header]`).

**Palette:** page `#07090D`, surfaces `#0D1117` / `#121821`, borders white at
8%, text `#F5F7FA` (18.6:1) and `#A3ACB9` (8.7:1), navy `#0F1B2D`, glow blues
`#1E3A8A` / `#3B5BDB` (graphics only, never text), silver `#C9D0D7`, and
`#8FA4FF` for the small blue labels (8.5:1). Gradients appear only in graphics
and headline accents, never behind body text.

Each section is its own component in `src/components/home/`:

| Section                                                                                                                                                                                                                                                                                                            | Component                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Announcement bar, with a blue gradient line under it                                                                                                                                                                                                                                                               | `announcement-bar.tsx`                    |
| Navbar: Q mark + "Quill", Product / How it works / FAQ, white "Launch app"; sticky and glassy                                                                                                                                                                                                                      | `home-navbar.tsx`                         |
| Hero: pill label, two-line headline with "_Quill_" in a silver-to-blue gradient, subtext, a step word that slides vertically (Search → Research → Approve → Trade), "Launch Quill" and "See how it works", and slowly turning rings with a feather curve below the text; drifting orbs and a faded dot grid behind | `hero.tsx`                                |
| Statement: "Clarity is the best edge."                                                                                                                                                                                                                                                                             | `statement.tsx`                           |
| How Quill works (`#how-it-works`): Search, Research, Approve, Trade in a row joined by a gradient line; the steps light up one by one on scroll                                                                                                                                                                    | `how-quill-works.tsx`                     |
| Feature rows (`#features`): Research, Search, Trade, each with a blue label and a gradient graphic, swapping sides                                                                                                                                                                                                 | `feature-rows.tsx`, `feature-visuals.tsx` |
| Bento grid (`#product`): a wide card with its own graphic, then three; gradient borders, glowing icon circles                                                                                                                                                                                                      | `bento-grid.tsx`                          |
| FAQ (`#faq`)                                                                                                                                                                                                                                                                                                       | `faq.tsx`                                 |
| Email signup (Resend, `/api/subscribe`)                                                                                                                                                                                                                                                                            | `src/components/subscribe-box.tsx`        |
| Final call to action: navy-to-black panel with a glowing orb in a corner                                                                                                                                                                                                                                           | `final-cta.tsx`                           |

Shared effects (orbs, faded grid, gradient-bordered card with a hover glow,
grain, SVG gradients) are in `effects.tsx`. Then a gray "Research only. Not
financial advice." line and the site-wide `DitheredFooter`, here in dark with
blue (`#3B5BDB`) dots.

**Rules:** no tokens, tickers, prices, charts, chat examples or market data,
and no market data API calls (checked in the browser). No made-up logos,
testimonials or stats. All graphics are CSS/SVG; no images.

**Motion:** orbs drift, the hero rings turn (90 s a turn), the step word
slides every 2.2 s, sections fade in on scroll, cards lift and glow on hover.
Under `prefers-reduced-motion` none of it moves. On phones the second orb and
the feather's glow are left out.

**Logo:** the Q mark (`src/components/brand/quill-mark.tsx`): a ring, a
feather inside it, and the Q's tail as a pen nib. White in the home navbar; on
navy as the favicon (`src/app/icon.svg`), Apple touch icon and install icons
(`public/brand/quill-icon-*.png`, `public/brand/quill-q-icon.svg`). The rest of
the site still uses the nib wordmark.

## Fonts, scrolling and hover effects

- **Fonts (home only, `src/components/home/fonts.ts`):** Sora 600/700 for
  headings, Instrument Serif Italic for the accent words, Manrope 400–600 for
  text, buttons, nav and cards, and Geist Mono 500 for small labels and step
  numbers. They load only on this page; the rest of the site keeps Geist.
- **No dividers:** sections share the `#07090D` background and are separated
  by spacing; glows cross section edges (the page wrapper clips sideways
  overflow). The navbar's border shows only once scrolled; the footer's top
  border is hidden on this page.
- **Smooth scrolling:** Lenis (`smooth-scroll.tsx`, home only, about 1.1 s,
  anchor links glide to their section). Off under reduced motion, where native
  scrolling (with `scroll-behavior: smooth` as a fallback) applies.
- **Performance:** only transform and opacity animate on scroll; orbs keep a
  fixed blur and drift with transform; looping animations pause off screen
  (`PauseOffscreen`); scroll-in animations run once (IntersectionObserver via
  `Reveal`); the grain is left out on phones.
- **Hover effects (mouse only, `hover-text.tsx` + `globals.css`):** headline
  words lift and brighten; gradient accents sweep; the statement spreads and
  glows; row labels turn silver with an arrow and headlines get a growing
  underline; bento titles brighten and icons tilt; steps grow and light the line
  up to them; nav links get a centre-out underline; footer links lift; buttons
  get a light sweep. Movement is dropped under reduced motion.
