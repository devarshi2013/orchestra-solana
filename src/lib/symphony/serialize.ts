import type { z } from "zod";

import { symphonySchema } from "./schema";
import type { Symphony } from "./types";

/**
 * Stable JSON for storage and sharing. Parsing through the schema first drops
 * unknown keys and fixes key order, so equal symphonies serialize identically.
 */
export function serializeSymphony(symphony: Symphony): string {
  return JSON.stringify(symphonySchema.parse(symphony));
}

export type ParseSymphonyResult =
  { ok: true; symphony: Symphony } | { ok: false; error: string; issues?: z.core.$ZodIssue[] };

/** Structural parse only; run validateSymphony() before trusting the tree. */
export function parseSymphony(json: string): ParseSymphonyResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "Not valid JSON" };
  }
  const parsed = symphonySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Not a valid symphony", issues: parsed.error.issues };
  }
  return { ok: true, symphony: parsed.data };
}
