"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { TickertapeMark } from "@/components/brand/tickertape-mark";
import { useWallet, WalletButton } from "@/components/wallet";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

import { useSearchVisibility } from "./search-visibility";
import { StockSearch } from "./stock-search";

const NAV_LINK =
  "inline-flex h-10 items-center px-2 text-[length:var(--text-button-lg)] leading-none font-semibold text-text-low transition-colors duration-150 hover:text-text-extra-high focus-visible:ring-2 focus-visible:ring-text-extra-high/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

const LINKS = [
  { label: "Explore", href: "/explore" },
  { label: "Research", href: "/chat" },
] as const;

/**
 * The header on every page, as on tokens.xyz: fixed, transparent at the top
 * and blurred once the page scrolls; the mark and name with the main links on
 * the left, the ⌘K stock search centred, the wallet on the right. The search
 * hides while the home page's own search is on screen.
 */
export function SiteHeader() {
  const { heroVisible } = useSearchVisibility();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b transition-colors duration-200",
        scrolled
          ? "border-border-light/70 bg-background/70 backdrop-blur-sm"
          : "border-transparent bg-transparent",
      )}
    >
      <a
        href="#main"
        className="sr-only rounded-full bg-white px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-4 focus:left-6 focus:z-50 focus:ring-2 focus:ring-border-medium"
      >
        Skip to content
      </a>
      <div className="mx-auto grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-4">
        <div className="flex min-w-0 items-center gap-6 lg:gap-8">
          <Link href="/" aria-label="Tickertape home" className="group flex items-center gap-2">
            <TickertapeMark className="h-6 text-text-extra-high" />
            <span className="text-2xl font-semibold text-text-extra-high" aria-hidden>
              Tickertape
            </span>
          </Link>
          <nav aria-label="Browse" className="hidden shrink-0 items-center gap-4 lg:flex">
            {/* The current page is only known at request time on dynamic routes (cacheComponents). */}
            <Suspense fallback={<NavLinks pathname={null} />}>
              <CurrentNavLinks />
            </Suspense>
          </nav>
        </div>

        <div className="flex items-center justify-center">
          <div
            className={cn(
              "transition-[opacity,transform] duration-200 ease-out",
              heroVisible
                ? "pointer-events-none translate-y-1 opacity-0"
                : "pointer-events-auto translate-y-0 opacity-100",
            )}
          >
            <StockSearch />
          </div>
        </div>

        <nav
          aria-label="Account"
          className="hidden items-center justify-end gap-3 justify-self-end sm:flex sm:gap-4"
        >
          <WalletButton />
        </nav>
      </div>
    </header>
  );
}

function CurrentNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

/** The main links (and Profile once a wallet is connected); the current page's is darker. */
function NavLinks({ pathname }: { pathname: string | null }) {
  const { connected } = useWallet();
  const current = (href: string) =>
    pathname != null &&
    (pathname === href ||
      pathname.startsWith(`${href}/`) ||
      (href === "/explore" && pathname.startsWith("/stocks/")));
  const links = connected ? [...LINKS, { label: "Portfolio", href: "/portfolio" } as const] : LINKS;
  return links.map(({ label, href }) => (
    <Link
      key={href}
      href={href}
      aria-current={current(href) ? "page" : undefined}
      className={cn(NAV_LINK, "relative", current(href) && "text-text-extra-high")}
    >
      {label}
      {href === "/portfolio" && <UnreadDot />}
    </Link>
  ));
}

/** A small dot on Profile while the signed-in wallet has unread notifications. */
function UnreadDot() {
  const { data } = useProfile(60_000);
  const unread = data?.notifications.filter((n) => !n.readAt).length ?? 0;
  if (!unread) return null;
  return (
    <span className="absolute top-2 right-0.5 size-1.5 rounded-full bg-red-600">
      <span className="sr-only">{unread} unread notifications</span>
    </span>
  );
}
