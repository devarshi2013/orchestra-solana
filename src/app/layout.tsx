import type { Metadata, Viewport } from "next";

import { SearchVisibilityProvider } from "@/components/layout/search-visibility";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { MotionProvider } from "@/components/motion";
import { PnlToaster } from "@/components/share/pnl-toast";
import { WalletRoot } from "@/components/wallet";
import { AutoSignIn } from "@/components/wallet/auto-sign-in";

import { TAGLINE } from "@/lib/brand";

import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const description =
  "Tickertape: every tokenized US stock on Solana, from every issuer, live from Jupiter. Research with AI and approve every trade in your own wallet.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `Tickertape: ${TAGLINE}`, template: "%s · Tickertape" },
  description,
  applicationName: "Tickertape",
  openGraph: { title: "Tickertape", description, siteName: "Tickertape", type: "website" },
  twitter: { card: "summary_large_image", title: "Tickertape", description },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/InterVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-dvh flex-col bg-background font-sans antialiased">
        <MotionProvider>
          <WalletRoot>
            <AutoSignIn />
            <SearchVisibilityProvider>
              <SiteHeader />
              <div id="main" className="flex flex-1 flex-col">
                {children}
              </div>
              {/* Hidden on /chat, which fills the screen under the header (globals.css). */}
              <div data-site-footer>
                <SiteFooter />
              </div>
              <PnlToaster />
            </SearchVisibilityProvider>
          </WalletRoot>
        </MotionProvider>
      </body>
    </html>
  );
}
