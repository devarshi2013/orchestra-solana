import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

import { MotionProvider } from "@/components/motion";
import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { themeScript } from "@/components/layout/theme-toggle";
import { GitHubIcon, XIcon } from "@/components/brand/social-icons";
import { SiteHeader } from "@/components/site-header";
import { DitheredFooter, type FooterColumn } from "@/components/ui/dithered-footer";
import { Toaster } from "@/components/ui/toast";

import { TAGLINE } from "@/lib/brand";

import "./globals.css";

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

/** Body text: highly legible at small sizes, with tabular figures. */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
/**
 * Headings and the wordmark: Fraunces, a literary "old style" serif, for the
 * ink-and-paper feel of Quill. Variable, with an optical-size axis so large
 * headings get finer contrast and small ones stay sturdy.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});
/** Prices and amounts: fixed-width figures and a slashed zero. */
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const description =
  "Quill: tell an AI what you want in tokenized US stocks on Solana, see live Jupiter quotes, and approve every buy in your own wallet.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `Quill: ${TAGLINE}`, template: "%s · Quill" },
  description,
  applicationName: "Quill",
  openGraph: { title: "Quill", description, siteName: "Quill", type: "website" },
  twitter: { card: "summary_large_image", title: "Quill", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#0f1b2d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
      // The theme script adds class="dark" before hydration when the visitor chose it.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <MotionProvider>
          <SolanaWalletProvider>
            <SiteHeader />
            <div id="main" className="flex flex-1 flex-col">
              {children}
            </div>
            {/* Hidden on /chat, a full-screen app (see data-site-chrome in globals.css). */}
            <div data-site-chrome>
              <DitheredFooter
                brand="Quill"
                brandHref="/"
                tagline="Ask an AI about tokenized US stocks. Approve every trade in your own wallet."
                columns={FOOTER_COLUMNS}
                legal={[{ label: "Terms", href: "/terms" }]}
                socials={[
                  {
                    label: "Share Quill on X",
                    href: SHARE_ON_X,
                    icon: <XIcon className="size-4" />,
                  },
                  { label: "Quill on GitHub", href: REPO, icon: <GitHubIcon className="size-4" /> },
                ]}
                copyright="© 2026 Quill"
                status={null}
                // Dark navy dots (#0F1B2D); light gray on the dark theme, where navy can't be seen.
                accent="var(--footer-dots)"
                markColor="var(--footer-mark)"
              />
            </div>
            <Toaster />
          </SolanaWalletProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
