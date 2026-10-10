"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { QuillMark } from "@/components/brand/quill-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** App pages, then the home page's sections (plain anchors, so Lenis can glide to them on the home page). */
const LINKS = [
  { label: "Markets", href: "/markets", app: true },
  { label: "Research", href: "/chat", app: true },
  { label: "Product", href: "/#product", app: false },
  { label: "How it works", href: "/#how-it-works", app: false },
  { label: "FAQ", href: "/#faq", app: false },
];

/**
 * The navbar on every page: Q mark + "Quill", Markets and Research, the home
 * sections, and a white "Launch app". Sticky and lightly glassy; its bottom
 * border shows only once the page is scrolled. Phones get Markets and Research.
 */
export function SiteNavbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-background/75 backdrop-blur-sm transition-colors duration-300",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <a
        href="#main"
        className="sr-only rounded-md bg-card px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6"
      >
        <Link
          href="/"
          aria-label="Quill home"
          className="flex items-center gap-2 rounded-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <QuillMark className="size-8" />
          <span className="font-heading text-lg font-semibold tracking-tight" aria-hidden>
            Quill
          </span>
        </Link>
        <span className="flex-1" />
        <ul className="flex items-center gap-4 sm:gap-6">
          {LINKS.map((l) => (
            <li key={l.href} className={cn(!l.app && "hidden lg:block")}>
              {l.app ? (
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              ) : (
                <a href={l.href} className={linkClass}>
                  {l.label}
                </a>
              )}
            </li>
          ))}
        </ul>
        <Button asChild size="sm" className="hidden h-9 px-4 sm:inline-flex">
          <Link href="/markets">Launch app</Link>
        </Button>
      </nav>
    </header>
  );
}

const linkClass =
  "nav-underline rounded-sm text-sm font-medium text-muted-foreground transition-colors duration-250 ease-out outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-ring";
