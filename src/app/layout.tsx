import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SolanaWalletProvider } from "@/components/providers/wallet-provider";
import { SiteHeader } from "@/components/site-header";

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SolanaWalletProvider>
          <SiteHeader />
          {children}
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
