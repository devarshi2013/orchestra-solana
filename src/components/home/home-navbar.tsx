"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { QuillMark } from "@/components/brand/quill-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
];

/**
 * The home page's navbar: Q mark + "Quill", section links and a white "Launch
 * app". Sticky and lightly glassy; its bottom border shows only once scrolled.
 */
export function HomeNavbar() {
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
        href="#home-main"
        className="sr-only rounded-md bg-card px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-50 focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6"
      >
        <Link
          href="/"
          aria-label="Quill home"
          className="flex items-center gap-2 rounded-lg text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <QuillMark className="size-8" />
          <span className="text-lg font-semibold tracking-tight" aria-hidden>
            Quill
          </span>
        </Link>
        <span className="flex-1" />
        <ul className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="nav-underline rounded-sm text-sm font-medium text-muted-foreground transition-colors duration-250 ease-out outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-ring"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <Button asChild size="sm" className="h-9 px-4">
          <Link href="/chat">Launch app</Link>
        </Button>
      </nav>
    </header>
  );
}
