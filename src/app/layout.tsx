import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

import { MotionProvider } from "@/components/motion";
import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { themeScript } from "@/components/layout/theme-toggle";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/toast";

import { TAGLINE } from "@/lib/brand";

import "./globals.css";

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
            <SiteFooter />
            <Toaster />
          </SolanaWalletProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
