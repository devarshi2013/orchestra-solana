import Link from "next/link";

import { TickertapeMark } from "@/components/brand/tickertape-mark";

const LINKS = [
  { label: "Explore", href: "/explore" },
  { label: "Research", href: "/chat" },
  { label: "GitHub", href: "https://github.com/devarshi2013/orchestra-solana" },
  { label: "Risk", href: "/risk" },
  { label: "Terms", href: "/terms" },
];

const LINK =
  "text-[13px] tracking-[-0.01em] text-ink-muted transition-colors hover:text-text-extra-high";

/** One quiet row: the mark, the links, the copyright. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border-extra-light">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-6">
        <Link href="/" aria-label="Tickertape home" className="text-text-extra-high">
          <TickertapeMark className="h-5" />
        </Link>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {LINKS.map(({ label, href }) =>
            href.startsWith("http") ? (
              <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
                {label}
              </a>
            ) : (
              <Link key={href} href={href} className={LINK}>
                {label}
              </Link>
            ),
          )}
        </nav>
        <p className="ml-auto text-[13px] text-ink-muted">© 2026 Tickertape</p>
      </div>
    </footer>
  );
}
