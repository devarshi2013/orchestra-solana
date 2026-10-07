"use client";

import { useEffect, useRef } from "react";

import { searchTokens } from "@/lib/api-client";
import { useSymphonyEditor } from "@/stores/symphony-editor";

/** The token search route caps queries at 200 characters: four mints per request. */
const MINTS_PER_LOOKUP = 4;

/**
 * Looks up metadata for mints the editor doesn't know yet (pasted JSON, an
 * opened draft), once each. Mints Jupiter doesn't return stay unknown, which
 * validation reports.
 */
export function useResolveTokens(mints: readonly string[]) {
  const known = useSymphonyEditor((s) => s.tokens);
  const rememberTokens = useSymphonyEditor((s) => s.rememberTokens);
  const tried = useRef(new Set<string>());
  const key = mints.filter((mint) => !known[mint]).join(",");

  useEffect(() => {
    const batch = key ? key.split(",").filter((mint) => !tried.current.has(mint)) : [];
    if (batch.length === 0) return;
    batch.forEach((mint) => tried.current.add(mint));
    for (let i = 0; i < batch.length; i += MINTS_PER_LOOKUP) {
      const chunk = batch.slice(i, i + MINTS_PER_LOOKUP);
      searchTokens(chunk.join(","))
        .then((tokens) => rememberTokens(tokens.filter((t) => chunk.includes(t.mint))))
        .catch(() => chunk.forEach((mint) => tried.current.delete(mint)));
    }
  }, [key, rememberTokens]);
}
