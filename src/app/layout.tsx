import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";

import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { RebalanceBanner } from "@/components/invest/rebalance-banner";
import { SiteFooter } from "@/components/layout/site-footer";
import { themeScript } from "@/components/layout/theme-toggle";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/toast";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orchestra",
  description: "Build, backtest and run rule-based Solana token portfolios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme script sets class="dark" before hydration.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SolanaWalletProvider>
          <SiteHeader />
          {/* Reads the URL (usePathname), so it streams in rather than blocking prerender. */}
          <Suspense fallback={null}>
            <RebalanceBanner />
          </Suspense>
          <div id="main" className="flex flex-1 flex-col">
            {children}
          </div>
          <SiteFooter />
          <Toaster />
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
