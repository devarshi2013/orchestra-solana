import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/layout/site-footer";
import { MotionProvider } from "@/components/motion";
import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { SiteNavbar } from "@/components/layout/site-navbar";
import { SmoothScroll } from "@/components/layout/smooth-scroll";
import { Toaster } from "@/components/ui/toast";

import { TAGLINE } from "@/lib/brand";

import { fontVariables } from "./fonts";
import "./globals.css";

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
  themeColor: "#07090d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // One dark theme for the whole site; "dark" keeps any dark: variants consistent.
    <html lang="en" className="dark h-full">
      <body className={`${fontVariables} flex min-h-full flex-col font-sans antialiased`}>
        <MotionProvider>
          <SolanaWalletProvider>
            <SmoothScroll />
            {/* The home page renders this navbar itself, under its announcement bar. */}
            <div data-site-header className="sticky top-0 z-40">
              <SiteNavbar />
            </div>
            <div id="main" className="flex flex-1 flex-col">
              {children}
            </div>
            {/* Hidden on /chat, which fills the screen under the navbar (globals.css). */}
            <div data-site-footer>
              <SiteFooter />
            </div>
            <Toaster />
          </SolanaWalletProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
