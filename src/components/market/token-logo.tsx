"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A token's logo from Jupiter in a circle, or its first two letters when it has
 * none or the image fails to load.
 */
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
          "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-text-medium",
          className,
        )}
      >
        {symbol.slice(0, 2).toUpperCase()}
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
      className={cn("size-8 shrink-0 rounded-full bg-gray-50 object-cover", className)}
    />
  );
}
