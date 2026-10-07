"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { TokenInfo } from "@/lib/tokens";

export function TokenAvatar({ token, className }: { token: TokenInfo; className?: string }) {
  // Some icon hosts refuse cross-origin loads (CORP) or 403; fall back to the symbol.
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  if (token.icon && token.icon !== failedIcon) {
    return (
      // Token icons come from arbitrary hosts, so next/image's allowlist doesn't fit.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={token.icon}
        alt=""
        onError={() => setFailedIcon(token.icon)}
        className={cn("size-6 shrink-0 rounded-full bg-muted object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[0.65rem] font-semibold",
        className,
      )}
    >
      {token.symbol.slice(0, 3)}
    </span>
  );
}
