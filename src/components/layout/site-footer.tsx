import { ArrowUpRight, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { Reveal } from "@/components/motion";
import { GitHubIcon, XIcon } from "@/components/brand/social-icons";
import { TAGLINE } from "@/lib/brand";

const REPO = "https://github.com/devarshi2013/orchestra-solana";
/** No X account yet: the X icon shares Quill instead of linking a profile. */
const SHARE_ON_X = `https://x.com/intent/post?text=${encodeURIComponent(
  "Quill: an AI that researches tokenized US stocks on Solana, and only buys after you approve.",
)}`;

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Markets", href: "/" },
      { label: "How it works", href: "/#how-it-works" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: `${REPO}/tree/main/docs`, external: true },
      { label: "GitHub", href: REPO, external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Risk disclosure", href: "/risk" },
    ],
  },
];

const linkClass =
  "link-grow inline-flex items-center gap-1 rounded-sm text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Brand and tagline, link columns, then the credits and the not-advice line. */
export function SiteFooter() {
  return (
    <footer data-site-chrome className="mt-16 border-t bg-surface-raised/30">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <Reveal className="grid gap-10 py-12 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="space-y-4">
            <Link
              href="/"
              aria-label="Quill home"
              className="inline-flex rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Wordmark />
            </Link>
            <p className="max-w-xs font-serif text-base text-foreground">{TAGLINE}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Ask an AI about tokenized US stocks, then approve every buy in your own wallet.
            </p>
            <div className="flex items-center gap-1">
              <a
                href={SHARE_ON_X}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share Quill on X"
                title="Share on X"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-primary/30 text-primary-text transition-[color,background-color,transform] hover:bg-primary/8 hover:text-foreground active:scale-95"
              >
                <XIcon className="size-4" />
              </a>
              <a
                href={REPO}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Quill on GitHub"
                title="GitHub"
                className="inline-flex size-9 items-center justify-center rounded-lg border border-primary/30 text-primary-text transition-[color,background-color,transform] hover:bg-primary/8 hover:text-foreground active:scale-95"
              >
                <GitHubIcon className="size-4" />
              </a>
            </div>
          </div>

          <nav aria-label="Footer" className="contents">
            {COLUMNS.map((column) => (
              <div key={column.title} className="space-y-3">
                <h2 className="text-xs font-semibold tracking-wider text-foreground uppercase">
                  {column.title}
                </h2>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                        >
                          {link.label} <ArrowUpRight className="size-3 opacity-60" aria-hidden />
                        </a>
                      ) : (
                        <Link href={link.href} className={linkClass}>
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </Reveal>

        <div className="flex flex-col gap-3 border-t py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            Powered by{" "}
            <a
              href="https://jup.ag"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Jupiter
            </a>{" "}
            · Built on{" "}
            <a
              href="https://solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Solana
            </a>{" "}
            · AI by{" "}
            <a
              href="https://www.anthropic.com/claude"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              Claude
            </a>
          </p>
          <p className="flex items-start gap-1.5 md:max-w-md md:text-right">
            <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
            Not financial advice. Tokenized stocks are securities with eligibility rules.
          </p>
          <p>© 2026 Quill</p>
        </div>
      </div>
    </footer>
  );
}
