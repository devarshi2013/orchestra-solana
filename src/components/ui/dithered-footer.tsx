"use client";

import { useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import { DITHER, GRID } from "./dither-mask";

// Dithered Footer by Ato Augustine (MIT), from 21st.dev/@otatechie/components/dithered-footer.
// Cut down for Quill: a logo and tagline, one short row of links, the dot band
// (unchanged), then a disclaimer and the copyright. No link columns, signup
// form, social row or "Back to top".

export type FooterLink = { label: string; href: string; icon?: ReactNode };

export type DitheredFooterProps = {
  logo?: ReactNode;
  tagline: string;
  links: FooterLink[];
  /** Small print under the dot band (may contain links). */
  disclaimer: ReactNode;
  copyright: string;
  /** "Built by …" after the copyright; `href` makes the name a link (opens in a new tab). */
  credit?: { name: string; href?: string } | null;
  /** Colour of the dot field. It is the footer's only colour, so it carries the brand. */
  accent?: string;
};

// Scoped by the df- prefix. Masks and motion live here rather than in utility
// classes, so the component renders the same on Tailwind v3 and v4.
const STYLES = `
.df-field { position: absolute; inset: 0; }
.df-field.df-lit {
  -webkit-mask-image: radial-gradient(circle 190px at var(--df-x, 50%) var(--df-y, 50%), #000 35%, rgb(0 0 0 / .22) 100%);
  mask-image: radial-gradient(circle 190px at var(--df-x, 50%) var(--df-y, 50%), #000 35%, rgb(0 0 0 / .22) 100%);
}
.df-dots {
  position: absolute; top: 0; bottom: 0; left: 0;
  width: calc(100% + 360px);
  background: var(--df-accent);
  -webkit-mask-image: ${GRID}, ${DITHER};
  mask-image: ${GRID}, ${DITHER};
  -webkit-mask-size: 4px 4px, 360px 240px;
  mask-size: 4px 4px, 360px 240px;
  -webkit-mask-repeat: repeat, repeat-x;
  mask-repeat: repeat, repeat-x;
  -webkit-mask-position: 0 0, left bottom;
  mask-position: 0 0, left bottom;
  -webkit-mask-composite: source-in;
  mask-composite: intersect;
}
@media (prefers-reduced-motion: no-preference) {
  .df-dots { animation: df-drift 40s linear infinite; }
}
@keyframes df-drift { to { translate: -360px 0; } }
/* Links: muted, brightening, with an underline that slides in from the left. */
.df-link {
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: 0% 1px;
  padding-bottom: 2px;
  transition: color 250ms ease-out, background-size 300ms ease-out;
}
.df-link:hover, .df-link:focus-visible { background-size: 100% 1px; }
@media (prefers-reduced-motion: reduce) {
  .df-link { transition: color 250ms ease-out; }
}
`;

/** External links open in a new tab. */
const external = (href: string) =>
  /^https?:\/\//.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--df-accent)]";

export function DitheredFooter({
  logo,
  tagline,
  links,
  disclaimer,
  copyright,
  credit = null,
  accent = "#ff6a00",
}: DitheredFooterProps) {
  const field = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  // Spotlight: dots under a mouse pointer stay at full strength and the rest dim.
  // Touch and pen get the plain field; there is no hover to follow.
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !field.current) return;
    const el = field.current;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left,
      y = e.clientY - r.top;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.setProperty("--df-x", `${x}px`);
      el.style.setProperty("--df-y", `${y}px`);
      el.classList.add("df-lit");
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(frame.current);
    field.current?.classList.remove("df-lit");
  };

  return (
    <footer
      className="overflow-hidden bg-background text-foreground"
      style={{ "--df-accent": accent } as CSSProperties}
    >
      <style>{STYLES}</style>

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 pt-10 pb-10 text-center sm:px-8 md:flex-row md:items-end md:justify-between md:pt-12 md:pb-12 md:text-left">
        <div className="flex flex-col items-center gap-4 md:items-start">
          {logo}
          <p className="max-w-lg font-heading text-xl leading-[1.45] font-medium tracking-tight text-foreground sm:text-2xl sm:leading-[1.4]">
            {tagline}
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:justify-end">
            {links.map((l) => (
              <li key={l.label} className="flex">
                <a
                  href={l.href}
                  {...external(l.href)}
                  className={`df-link inline-flex items-center gap-2 rounded-sm font-sans text-sm text-muted-foreground hover:text-foreground focus-visible:text-foreground ${focus}`}
                >
                  {l.icon}
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* A short decorative strip of drifting dots that brighten under the mouse. */}
      <div
        aria-hidden="true"
        className="df-band relative h-32 overflow-hidden"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <div ref={field} className="df-field">
          {/* One tile wider than the band, slid left by exactly one tile, so the loop is seamless. */}
          <div className="df-dots" />
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 pt-6 pb-6 text-center sm:px-8 md:flex-row md:items-start md:justify-between md:pb-8 md:text-left">
        <p className="max-w-[60ch] text-xs leading-relaxed text-muted-foreground">{disclaimer}</p>
        <p className="shrink-0 text-xs leading-relaxed text-muted-foreground">
          {copyright}
          {credit && (
            <>
              {" · "}Built by{" "}
              {credit.href ? (
                <a
                  href={credit.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`df-link rounded-sm font-medium text-foreground/80 hover:text-foreground ${focus}`}
                >
                  {credit.name}
                </a>
              ) : (
                <span className="font-medium text-foreground">{credit.name}</span>
              )}
            </>
          )}
        </p>
      </div>
    </footer>
  );
}
