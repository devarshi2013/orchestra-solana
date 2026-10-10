import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { MotionProvider } from "@/components/motion";
import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { themeScript } from "@/components/layout/theme-toggle";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/toast";

import { TAGLINE } from "@/lib/brand";

import "./globals.css";

/** Geist for all text; Geist Mono for prices, tickers and addresses (tabular figures). */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
      className="h-full"
      // The theme script adds class="dark" before hydration when the visitor chose it.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-full flex-col font-sans antialiased`}
      >
        <MotionProvider>
          <SolanaWalletProvider>
            <SiteHeader />
            <div id="main" className="flex flex-1 flex-col">
              {children}
            </div>
            {/* Hidden on /chat, a full-screen app (see data-site-chrome in globals.css). */}
            <div data-site-chrome>
              <SiteFooter />
            </div>
            <Toaster />
          </SolanaWalletProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
