"use client";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

import { useSearchVisibility } from "@/components/layout/search-visibility";
import { CommandKeys, openSearch } from "@/components/layout/stock-search";

/**
 * The home page's big search field. It opens the ⌘K palette, and while it is
 * on screen the header hides its own search (tokens.xyz does the same).
 */
export function HeroSearch() {
  const ref = useRef<HTMLDivElement>(null);
  const { setHeroVisible } = useSearchVisibility();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      setHeroVisible(false);
    };
  }, [setHeroVisible]);

  return (
    <div ref={ref} className="group relative mx-auto max-w-[580px] px-4 md:px-0">
      <div className="pointer-events-none absolute inset-y-0 left-8 flex items-center md:left-5">
        <Search
          className="size-5 text-text-extra-low transition-colors group-hover:text-text-low"
          aria-hidden
        />
      </div>
      <button
        type="button"
        onClick={openSearch}
        className="w-full cursor-pointer rounded-full border-2 border-border-medium bg-white py-3.5 pr-4 pl-12 text-left text-text-extra-low ring-border-light/50 transition-[box-shadow,border-color,background-color] hover:ring-4 focus:outline-none focus-visible:ring-4 motion-reduce:transition-none md:py-4.5 md:pr-8 md:pl-14"
      >
        <span className="text-[15px] md:text-[17px]">Search stocks by name or ticker</span>
      </button>
      <div className="absolute top-1/2 right-8 hidden -translate-y-1/2 sm:block md:right-6">
        <CommandKeys size="md" />
      </div>
    </div>
  );
}
