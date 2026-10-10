"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import { DITHER, GRID } from "./dither-mask";

// Dithered Footer by Ato Augustine (MIT), from 21st.dev/@otatechie/components/dithered-footer.
// Changed for Quill: the signup form only renders when `onSubscribe` is passed
// (it shows the error `onSubscribe` throws, and has a hidden honeypot field),
// external links open in a new tab, the status dot uses the accent, a "Built by"
// credit can follow the copyright (`credit`), and there is no brand name: neither
// the small link at the top nor the large one in the dot band, which is now a
// short decorative strip.

export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterSocial = { label: string; href: string; icon: ReactNode };

export type DitheredFooterProps = {
  tagline?: string;
  columns?: FooterColumn[];
  socials?: FooterSocial[];
  legal?: FooterLink[];
  copyright?: string;
  /** "Built by …" after the copyright; `href` makes the name a link (opens in a new tab). */
  credit?: { name: string; href?: string } | null;
  /** Link to your real status page, shown with a dot. Off unless you pass one. */
  status?: FooterLink | null;
  /** Colour of the dot field. It is the footer's only colour, so it carries the brand. */
  accent?: string;
  /**
   * Called with the email address and the honeypot field's value (only bots
   * fill it). Resolve to show the thank-you; throw an Error to show its
   * message. Without it there is no signup form.
   */
  onSubscribe?: (email: string, honeypot: string) => void | Promise<void>;
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
`;

const toLinks = (labels: string[]): FooterLink[] =>
  labels.map((label) => ({ label, href: "/" + label.toLowerCase().replace(/\s+/g, "-") }));

/** External links open in a new tab. */
const external = (href: string) =>
  /^https?:\/\//.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d={d} />
  </svg>
);

const DEFAULT_SOCIALS: FooterSocial[] = [
  {
    label: "X",
    href: "https://x.com",
    icon: icon(
      "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com",
    icon: icon(
      "M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5",
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com",
    icon: icon(
      "M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z",
    ),
  },
];

const DEFAULT_COLUMNS: FooterColumn[] = [
  { title: "Product", links: toLinks(["Features", "Pricing", "Changelog", "Roadmap"]) },
  { title: "Resources", links: toLinks(["Docs", "Guides", "Community", "Blog"]) },
  { title: "Company", links: toLinks(["About", "Careers", "Contact", "Press"]) },
];

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--df-accent)]";
const coarse =
  "[@media(pointer:coarse)]:inline-flex [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:items-center";

export default function DitheredFooter({
  tagline = "Tools for teams who ship. Built in the open, one release at a time.",
  columns = DEFAULT_COLUMNS,
  socials = DEFAULT_SOCIALS,
  legal = toLinks(["Privacy", "Terms"]),
  copyright = `© ${new Date().getFullYear()} Acme, Inc.`,
  status = null,
  credit = null,
  accent = "#ff6a00",
  onSubscribe,
}: DitheredFooterProps) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!onSubscribe || state === "sending") return;
    setState("sending");
    try {
      await onSubscribe(email, honeypot.current?.value ?? "");
      setState("done");
      setEmail("");
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.",
      );
      setState("error");
    }
  };

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

  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });

  return (
    <footer
      className="overflow-hidden border-t border-border bg-background text-foreground"
      style={{ "--df-accent": accent } as CSSProperties}
    >
      <style>{STYLES}</style>

      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-12 px-6 pt-16 pb-16 sm:gap-x-10 sm:px-8 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <div className="col-span-2 md:col-span-1">
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{tagline}</p>

          {onSubscribe && (
            <form className="relative mt-8 max-w-sm" onSubmit={submit}>
              {/* A visible label, not a placeholder: placeholders vanish while you type. */}
              <label htmlFor="df-email" className="block text-sm font-medium">
                Get updates by email
              </label>
              {/* Honeypot: hidden from people (and screen readers), so only bots fill it in. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="df-website">Website</label>
                <input
                  ref={honeypot}
                  id="df-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  id="df-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setState("idle");
                  }}
                  className="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm transition-colors focus:border-[var(--df-accent)] focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-[var(--df-accent)] [@media(pointer:coarse)]:h-11"
                />
                <button
                  disabled={state === "sending"}
                  type="submit"
                  className={`h-10 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover active:scale-[0.97] disabled:opacity-60 ${focus} [@media(pointer:coarse)]:h-11`}
                >
                  {state === "sending" ? "Subscribing…" : "Subscribe"}
                </button>
              </div>
              <p role="status" className="mt-2 min-h-5 text-sm text-muted-foreground">
                {state === "done" && "Thanks, you're on the list."}
                {state === "error" && <span className="font-medium text-foreground">{error}</span>}
              </p>
              <p className="text-xs text-muted-foreground">No spam. Unsubscribe anytime.</p>
            </form>
          )}
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-medium text-foreground">{col.title}</p>
            <ul className="mt-4 space-y-3 [@media(pointer:coarse)]:space-y-0">
              {col.links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    {...external(l.href)}
                    className={`rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground ${focus} ${coarse}`}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
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

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <p className="flex flex-wrap gap-x-1.5">
              <span>{copyright}</span>
              {credit && (
                // On phones the credit wraps to its own line, without the separator.
                <span className="basis-full sm:basis-auto">
                  <span aria-hidden="true" className="hidden sm:inline">
                    ·{" "}
                  </span>
                  Built by{" "}
                  {credit.href ? (
                    <a
                      href={credit.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`rounded-sm font-medium text-foreground/80 transition-colors hover:text-foreground ${focus}`}
                    >
                      {credit.name}
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{credit.name}</span>
                  )}
                </span>
              )}
            </p>
            {legal.map((l) => (
              <a
                key={l.label}
                href={l.href}
                {...external(l.href)}
                className={`rounded-sm transition-colors hover:text-foreground ${focus} ${coarse}`}
              >
                {l.label}
              </a>
            ))}
            {status && (
              <a
                href={status.href}
                {...external(status.href)}
                className={`inline-flex items-center gap-2 rounded-sm transition-colors hover:text-foreground ${focus} ${coarse}`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[var(--df-accent)]"
                  aria-hidden="true"
                />
                {status.label}
              </a>
            )}
          </div>
          <div className="-mr-2 flex items-center gap-1">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                {...external(s.href)}
                aria-label={s.label}
                title={s.label}
                className={`grid h-9 w-9 place-items-center rounded-md transition-colors hover:bg-foreground/5 hover:text-foreground ${focus} [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11`}
              >
                {s.icon}
              </a>
            ))}
            {socials.length > 0 && <span className="mx-2 h-4 w-px bg-border" aria-hidden="true" />}
            <button
              type="button"
              onClick={toTop}
              className={`inline-flex items-center gap-1.5 rounded-sm px-1 transition-colors hover:text-foreground ${focus} ${coarse}`}
            >
              Back to top
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 19V5m-6 6 6-6 6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { DitheredFooter };
