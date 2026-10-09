/**
 * Makes a half-streamed Markdown reply safe to render: nothing that would show
 * as raw syntax for a moment (table pipes, a lone `**`, an unfinished
 * structured block) is shown until enough of it has arrived.
 */

export type StableMarkdown = {
  text: string;
  /**
   * What's being held back: a table without its header yet, a table row still
   * arriving (the table itself is shown), or a structured block.
   */
  pending: "table" | "row" | "comparison" | null;
};

const TABLE_LINE = /^\s*\|/;
const DELIMITER_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const COMPARISON_FENCE = /^\s*```\s*comparison\s*$/;
const FENCE = /^\s*```/;

export function stableMarkdown(text: string, streaming: boolean): StableMarkdown {
  if (!streaming) return { text, pending: null };

  const lines = text.split("\n");
  // The last line is still arriving (it has no newline yet).
  let partial = lines.pop() ?? "";

  // An unclosed ```comparison block: show nothing of it until the closing fence.
  let openFence = -1;
  lines.forEach((line, i) => {
    if (openFence >= 0) {
      if (FENCE.test(line)) openFence = -1;
    } else if (COMPARISON_FENCE.test(line)) openFence = i;
  });
  if (openFence >= 0) return { text: lines.slice(0, openFence).join("\n"), pending: "comparison" };
  // A fence line still being typed ("```compa") isn't known to be anything yet.
  if (/^\s*`/.test(partial)) partial = "";

  // A row of a table that's still arriving: hold it back until its newline.
  let pending: StableMarkdown["pending"] = null;
  if (TABLE_LINE.test(partial)) {
    partial = "";
    pending = "row";
  }

  // A table needs its header and delimiter rows before it renders as a table;
  // until then its lines would show as raw pipes.
  let start = lines.length;
  while (start > 0 && TABLE_LINE.test(lines[start - 1]!)) start--;
  const tableLines = lines.slice(start);
  if (pending === "row" && tableLines.length === 0) pending = "table"; // the header row itself
  if (tableLines.length > 0 && !(tableLines.length >= 2 && DELIMITER_ROW.test(tableLines[1]!))) {
    lines.splice(start);
    partial = "";
    pending = "table";
  }

  // An unmatched `**` in the line still arriving would show literally.
  if ((partial.match(/\*\*/g)?.length ?? 0) % 2 === 1) {
    partial = partial.slice(0, partial.lastIndexOf("**"));
  }

  const kept = partial ? [...lines, partial] : lines;
  return { text: kept.join("\n"), pending };
}
