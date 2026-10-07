"use client";

import { useEffect, useState } from "react";

import { searchTokens } from "@/lib/api-client";
import { EXAMPLE_TOKEN_SYMBOLS } from "@/lib/symphony/examples";
import { DEFAULT_TOKENS, type TokenInfo } from "@/lib/tokens";

const cache = new Map<string, TokenInfo>(DEFAULT_TOKENS.map((t) => [t.mint, t]));

/** Symbols for `mints`, looked up by mint (four per request) and cached for the page's life. */
export function useTokenSymbols(mints: readonly string[]): (mint: string) => string {
  const [, setVersion] = useState(0);
  const key = mints.filter((m) => !cache.has(m) && !EXAMPLE_TOKEN_SYMBOLS[m]).join(",");

  useEffect(() => {
    if (!key) return;
    const missing = key.split(",");
    for (let i = 0; i < missing.length; i += 4) {
      const chunk = missing.slice(i, i + 4);
      searchTokens(chunk.join(","))
        .then((tokens) => {
          tokens.filter((t) => chunk.includes(t.mint)).forEach((t) => cache.set(t.mint, t));
          setVersion((v) => v + 1);
        })
        .catch(() => {});
    }
  }, [key]);

  return (mint) => cache.get(mint)?.symbol ?? EXAMPLE_TOKEN_SYMBOLS[mint] ?? `${mint.slice(0, 4)}…`;
}
