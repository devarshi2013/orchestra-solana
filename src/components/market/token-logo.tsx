"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/** A token's logo from Jupiter, or its first letters when there's none or it fails to load. */
export function TokenLogo({
  src,
  symbol,
  className,
}: {
  src: string | null | undefined;
  symbol: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-semibold text-muted-foreground",
          className,
        )}
      >
        {symbol.slice(0, 3)}
      </span>
    );
  }
  return (
    // Logos come from many hosts (IPFS, Arweave, issuer sites), so next/image's
    // remote allow-list doesn't fit; these are small and lazy-loaded.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("size-8 shrink-0 rounded-full bg-muted object-cover", className)}
    />
  );
}
