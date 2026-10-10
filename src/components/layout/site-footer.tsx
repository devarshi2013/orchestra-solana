import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { GitHubIcon } from "@/components/brand/social-icons";
import { DitheredFooter } from "@/components/ui/dithered-footer";

const REPO = "https://github.com/devarshi2013/orchestra-solana";
const inline =
  "df-link rounded-sm text-foreground/80 hover:text-foreground focus-visible:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--df-accent)]";

/**
 * The site footer: the logo and tagline, three links (ask, browse, GitHub),
 * the dot band, then the "not financial advice" line (which carries the links
 * to the risk disclosure and the terms) and the copyright.
 */
export function SiteFooter() {
  return (
    <DitheredFooter
      logo={<Wordmark markClassName="size-7" />}
      tagline="Ask an AI about tokenized US stocks. Approve every trade in your own wallet."
      links={[
        { label: "Ask Quill", href: "/chat" },
        { label: "Browse stocks", href: "/markets" },
        { label: "GitHub", href: REPO, icon: <GitHubIcon className="size-4" /> },
      ]}
      disclaimer={
        <>
          Research only. Not financial advice. Tokenized stocks carry risk, and the AI can be wrong:
          read the{" "}
          <Link href="/risk" className={inline}>
            risk disclosure
          </Link>{" "}
          and the{" "}
          <Link href="/terms" className={inline}>
            terms
          </Link>{" "}
          before you trade.
        </>
      }
      copyright="© 2026 Quill"
      // No link yet: pass `href` (portfolio, GitHub or X) to make the name clickable.
      credit={{ name: "Devarshi" }}
      // Dark navy dots (#0F1B2D); light gray on the dark theme, where navy can't be seen.
      accent="var(--footer-dots)"
    />
  );
}
