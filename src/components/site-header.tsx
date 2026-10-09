import { Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { Wordmark } from "@/components/brand/logo";
import { MobileNav, NavLinks, NavLinksFallback } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet/wallet-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only rounded-md bg-surface px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <div className="relative mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Askfirst home"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Wordmark />
        </Link>
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
        <span className="flex-1" />
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href="/assistant">
            <Sparkles /> Ask the assistant
          </Link>
        </Button>
        <ThemeToggle />
        <WalletButton />
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>
      </div>
    </header>
  );
}
