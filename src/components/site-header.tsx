import Link from "next/link";

import { WalletButton } from "@/components/wallet/wallet-button";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <nav className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            Orchestra
          </Link>
          <Link href="/create" className="text-sm text-muted-foreground hover:text-foreground">
            Create
          </Link>
          <Link href="/invest" className="text-sm text-muted-foreground hover:text-foreground">
            Invest
          </Link>
          <Link href="/swap" className="text-sm text-muted-foreground hover:text-foreground">
            Swap
          </Link>
          <Link href="/symphonies" className="text-sm text-muted-foreground hover:text-foreground">
            Symphonies
          </Link>
          <Link href="/backtest" className="text-sm text-muted-foreground hover:text-foreground">
            Backtest
          </Link>
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
