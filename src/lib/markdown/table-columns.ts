/**
 * A rehype plugin that reads each Markdown table as a whole and marks its
 * columns: numeric columns are right-aligned (header included), and change
 * columns (returns, growth, % moves) get an explicit +/− sign and an up/down
 * mark for colouring. Works per column rather than per cell, so a column lines
 * up even when one cell is "n/a".
 */

type Text = { type: "text"; value: string };
type Element = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: Node[];
};
type Node = Text | Element | { type: string; children?: Node[] };

const isElement = (node: Node, tag?: string): node is Element =>
  node.type === "element" && (tag === undefined || (node as Element).tagName === tag);

const textOf = (node: Node): string =>
  node.type === "text"
    ? (node as Text).value
    : "children" in node && node.children
      ? node.children.map(textOf).join("")
      : "";

/** "$1,234.56", "−0.12%", "$3.2T", "45.1x", "120 bps", "0.4341", "n/a". */
const NUMERIC = /^[\s(]*[+−-]?\s*[$€£]?\s?[\d.,]+\s?(%|[KMBT]|x|bps|USDC|SOL)?\)?\s*$/i;
const MISSING = /^(n\/a|—|–|-|unavailable)$/i;
/** A percentage, optionally signed. */
const PERCENT = /^\s*([+−-])?\s*([\d.,]+)\s*%\s*$/;
/** Headers of columns whose values are moves up or down. */
const CHANGE_HEADER = /return|change|growth|perf|move|gain|\b(1|3|6)\s?[dwmy]\b|24h|7d|ytd/i;

function rows(table: Element): Element[][] {
  const out: Element[][] = [];
  for (const section of table.children) {
    if (!isElement(section)) continue;
    const trs =
      section.tagName === "tr" ? [section] : section.children.filter((c) => isElement(c, "tr"));
    for (const tr of trs as Element[]) {
      out.push(tr.children.filter((c): c is Element => isElement(c, "td") || isElement(c, "th")));
    }
  }
  return out;
}

function annotate(table: Element) {
  const [header, ...body] = rows(table);
  if (!header) return;
  header.forEach((th, col) => {
    const cells = body.map((r) => r[col]).filter((c): c is Element => c !== undefined);
    const values = cells.map((c) => textOf(c).trim()).filter((v) => v !== "" && !MISSING.test(v));
    if (values.length === 0) return;
    const numeric = values.filter((v) => NUMERIC.test(v)).length >= Math.ceil(values.length / 2);
    if (!numeric) return;
    const heading = textOf(th);
    const percents = values.filter((v) => PERCENT.test(v));
    const signed =
      percents.length >= Math.ceil(values.length / 2) &&
      (CHANGE_HEADER.test(heading) || percents.some((v) => /^\s*[+−-]/.test(v)));

    for (const cell of [th, ...cells]) {
      cell.properties = { ...cell.properties, dataNumeric: "true" };
    }
    if (!signed) return;
    for (const cell of cells) {
      const match = PERCENT.exec(textOf(cell));
      if (!match) continue;
      const value = Number(match[2]!.replace(/,/g, ""));
      const negative = match[1] === "-" || match[1] === "−";
      const direction = value === 0 ? "flat" : negative ? "down" : "up";
      const sign = direction === "flat" ? "" : negative ? "−" : "+";
      cell.properties = { ...cell.properties, dataChange: direction };
      // Rewrite the cell as one text node with a consistent sign.
      cell.children = [{ type: "text", value: `${sign}${match[2]}%` }];
    }
  });
}

function walk(node: Node) {
  if (isElement(node, "table")) annotate(node);
  if ("children" in node && node.children) node.children.forEach(walk);
}

export function rehypeTableColumns() {
  return (tree: Node) => walk(tree);
}
