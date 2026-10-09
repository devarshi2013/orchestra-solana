import { z } from "zod";

/**
 * A stock comparison the assistant can send as a fenced ```comparison block
 * of JSON, rendered as a sortable table (ComparisonTable). Numbers are raw
 * (USD, percent) so the UI formats them consistently; prices aren't part of
 * it, because the table shows Jupiter's live price for each ticker.
 */
const metric = z.number().finite().nullable().optional().default(null);

export const comparisonSchema = z.object({
  title: z.string().max(160).optional(),
  rows: z
    .array(
      z.object({
        company: z.string().min(1).max(120),
        ticker: z
          .string()
          .trim()
          .min(1)
          .max(12)
          .transform((t) => t.replace(/^\$/, "").toUpperCase()),
        /** USD. */
        marketCap: metric,
        /** Percent, e.g. 38.2 for +38.2%. */
        return1y: metric,
        pe: metric,
      }),
    )
    .min(1)
    .max(12),
});

export type Comparison = z.infer<typeof comparisonSchema>;
export type ComparisonRow = Comparison["rows"][number];

export function parseComparison(source: string): Comparison | null {
  try {
    const parsed = comparisonSchema.safeParse(JSON.parse(source));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Fallback for a block that isn't a valid comparison: its rows as a plain Markdown table. */
export function comparisonFallbackMarkdown(source: string): string | null {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return null;
  }
  const rows = (data as { rows?: unknown })?.rows ?? data;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const objects = rows.filter(
    (r): r is Record<string, unknown> => typeof r === "object" && r !== null && !Array.isArray(r),
  );
  if (objects.length === 0) return null;
  const keys = [...new Set(objects.flatMap((r) => Object.keys(r)))].slice(0, 8);
  const cell = (v: unknown) =>
    v === null || v === undefined
      ? "—"
      : String(typeof v === "object" ? JSON.stringify(v) : v)
          .replace(/\|/g, "\\|")
          .replace(/\n/g, " ");
  return [
    `| ${keys.map(cell).join(" | ")} |`,
    `|${keys.map(() => "---").join("|")}|`,
    ...objects.map((r) => `| ${keys.map((k) => cell(r[k])).join(" | ")} |`),
  ].join("\n");
}
