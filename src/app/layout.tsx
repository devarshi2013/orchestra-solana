import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";

import { MotionProvider } from "@/components/motion";
import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { themeScript } from "@/components/layout/theme-toggle";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/toast";

import "./globals.css";

/** Body text: highly legible at small sizes, with tabular figures. */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
/**
 * Headings and the wordmark: geometric with a slightly technical edge, which
 * suits a crypto/fintech product without the editorial feel of a serif, and
 * its figures stay crisp at heading sizes.
 */
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
/** Prices and amounts: fixed-width figures and a slashed zero. */
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const description =
  "Ask an AI about tokenized US stocks on Solana, see live Jupiter quotes, and approve every buy in your own wallet.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Askfirst: ask, then approve", template: "%s · Askfirst" },
  description,
  applicationName: "Askfirst",
  openGraph: { title: "Askfirst", description, siteName: "Askfirst", type: "website" },
  twitter: { card: "summary_large_image", title: "Askfirst", description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#111214" },
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
      // The theme script sets class="dark" before hydration.
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
            <SiteFooter />
            <Toaster />
          </SolanaWalletProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
