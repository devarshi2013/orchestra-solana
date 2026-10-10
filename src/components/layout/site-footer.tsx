import { GitHubIcon, XIcon } from "@/components/brand/social-icons";
import { DitheredFooter, type FooterColumn } from "@/components/ui/dithered-footer";

const REPO = "https://github.com/devarshi2013/orchestra-solana";
/** No X account yet: the X icon shares Quill instead of linking a profile. */
const SHARE_ON_X = `https://x.com/intent/post?text=${encodeURIComponent(
  "Quill: an AI that researches tokenized US stocks on Solana, and only buys after you approve.",
)}`;
/** Only pages that exist: there's no FAQ, About, Contact or Privacy page (yet). */
const FOOTER_COLUMNS: FooterColumn[] = [
  { title: "Product", links: [{ label: "How it works", href: "/#how-it-works" }] },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: `${REPO}/tree/main/docs` },
      { label: "Risk disclosure", href: "/risk" },
    ],
  },
];

/**
 * The site footer: DitheredFooter with Quill's links. No signup form here: the
 * email signup lives on the home page (SubscribeBox).
 */
export function SiteFooter() {
  return (
    <DitheredFooter
      brand="Quill"
      brandHref="/"
      tagline="Ask an AI about tokenized US stocks. Approve every trade in your own wallet."
      columns={FOOTER_COLUMNS}
      legal={[{ label: "Terms", href: "/terms" }]}
      socials={[
        { label: "Share Quill on X", href: SHARE_ON_X, icon: <XIcon className="size-4" /> },
        { label: "Quill on GitHub", href: REPO, icon: <GitHubIcon className="size-4" /> },
      ]}
      copyright="© 2026 Quill"
      // No link yet: pass `href` (portfolio, GitHub or X) to make the name clickable.
      credit={{ name: "Devarshi" }}
      status={null}
      // Dark navy dots (#0F1B2D); light gray on the dark theme, where navy can't be seen.
      accent="var(--footer-dots)"
      markColor="var(--footer-mark)"
    />
  );
}
