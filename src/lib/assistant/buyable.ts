import type { ToolCallView } from "@/lib/assistant/views";

/**
 * What a reply may offer to buy: only names (token symbols, and company
 * tickers with their tokens) that this turn's tool results returned. Each name
 * maps to its token symbols, most liquid first as the results listed them.
 * Nothing the model merely wrote counts, and no mint is ever read from text.
 */
export type Buyable = ReadonlyMap<string, string[]>;

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const isObject = (v: Json): v is { [key: string]: Json } =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const symbolsOf = (items: Json) =>
  (Array.isArray(items) ? items : [])
    .filter(isObject)
    .map((t) => ({ symbol: t.symbol, liquidity: t.liquidityUsd }))
    .filter((t): t is { symbol: string; liquidity: Json } => typeof t.symbol === "string")
    .sort((a, b) => Number(b.liquidity ?? -1) - Number(a.liquidity ?? -1))
    .map((t) => t.symbol);

/** Walks a parsed tool result for companies (ticker + tokens), quotes and token symbols. */
function collect(value: Json, out: Map<string, string[]>) {
  if (Array.isArray(value)) return value.forEach((v) => collect(v, out));
  if (!isObject(value)) return;
  const { ticker, tokens, symbol, requested, quotes } = value;
  if (typeof ticker === "string") {
    const listed = symbolsOf(tokens ?? null);
    if (!out.has(ticker) || listed.length > 0) out.set(ticker, listed.length ? listed : [ticker]);
  }
  if (typeof requested === "string" && Array.isArray(quotes)) {
    const quoted = symbolsOf(quotes);
    if (quoted.length > 0) out.set(requested, quoted);
  }
  if (typeof symbol === "string" && !out.has(symbol)) out.set(symbol, [symbol]);
  Object.values(value).forEach((v) => collect(v, out));
}

const BUYING_TOOLS = new Set(["searchStocks", "getSwapQuote", "getStockMetrics"]);

export function buyableFrom(tools: readonly ToolCallView[]): Buyable {
  const out = new Map<string, string[]>();
  for (const tool of tools) {
    if (!tool.ok || !tool.result || !BUYING_TOOLS.has(tool.name)) continue;
    try {
      collect(JSON.parse(tool.result) as Json, out);
    } catch {
      // A result cut short for the model: its symbols are still exact.
      for (const [, s] of tool.result.matchAll(/"symbol"\s*:\s*"([A-Za-z0-9.-]{1,20})"/g))
        if (s && !out.has(s)) out.set(s, [s]);
    }
  }
  return out;
}

// --- Marking a reply --------------------------------------------------------------

type Text = { type: "text"; value: string };
type Element = {
  type: "element";
  tagName: string;
  properties: Record<string, unknown>;
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

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One pattern for every name, longest first (NVDAx before NVDA), as a whole word. */
function namePattern(names: Iterable<string>): RegExp | null {
  const list = [...names].sort((a, b) => b.length - a.length).map(escape);
  return list.length ? new RegExp(`(?<![A-Za-z0-9])\\$?(${list.join("|")})(?![A-Za-z0-9])`) : null;
}

/** Elements whose text is never marked (code, links, existing marks). */
const SKIP = new Set(["code", "pre", "a", "buy-mention"]);

/**
 * A rehype plugin: in tables, each body row that names a buyable token gets a
 * trailing `buy-cell` (header and other rows get an empty cell, to keep the
 * columns aligned); in paragraphs and list items, the first mention gets a
 * `buy-mention` right after it. Each mark carries the name and an id, and its
 * block records the ids so the buy card can open under it.
 */
export function rehypeBuyable(buyable: Buyable) {
  const pattern = namePattern(buyable.keys());
  return () => (tree: Node) => {
    if (!pattern) return;
    let next = 0;
    const id = () => `buy-${next++}`;

    const markTable = (table: Element) => {
      const rows = (node: Node): Element[] =>
        isElement(node, "tr")
          ? [node]
          : "children" in node
            ? (node.children ?? []).flatMap(rows)
            : [];
      const all = rows(table);
      const body = all.filter((r) => !r.children.some((c) => isElement(c, "th")));
      const marked = body.filter((row) => {
        const name = pattern.exec(textOf(row))?.[1];
        if (!name) return false;
        const rowId = id();
        row.properties = { ...row.properties, dataBuyName: name, dataBuyId: rowId };
        row.children.push({
          type: "element",
          tagName: "buy-cell",
          properties: { name, id: rowId },
          children: [],
        });
        return true;
      });
      if (marked.length === 0) return;
      for (const row of all)
        if (!marked.includes(row))
          row.children.push({
            type: "element",
            tagName: body.includes(row) ? "td" : "th",
            properties: {},
            children: [],
          });
    };

    /** Splits the first mention inside `node`; returns its id and name, or null. */
    const markFirst = (node: Element): { id: string; name: string } | null => {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i]!;
        if (isElement(child)) {
          if (SKIP.has(child.tagName) || child.tagName === "ul" || child.tagName === "ol") continue;
          const found = markFirst(child);
          if (found) return found;
          continue;
        }
        if (child.type !== "text") continue;
        const text = (child as Text).value;
        const match = pattern.exec(text);
        if (!match) continue;
        const end = match.index + match[0].length;
        const mention = { id: id(), name: match[1]! };
        node.children.splice(
          i,
          1,
          { type: "text", value: text.slice(0, end) },
          {
            type: "element",
            tagName: "buy-mention",
            properties: mention,
            children: [],
          },
          { type: "text", value: text.slice(end) },
        );
        return mention;
      }
      return null;
    };

    const walk = (node: Node) => {
      if (isElement(node, "table")) return markTable(node);
      if (isElement(node) && SKIP.has(node.tagName)) return;
      if (isElement(node, "p") || isElement(node, "li")) {
        const mention = markFirst(node);
        if (mention)
          node.properties = {
            ...node.properties,
            dataBuyId: mention.id,
            dataBuyName: mention.name,
          };
        // Nested lists still get their own first mention.
        node.children.filter((c) => isElement(c, "ul") || isElement(c, "ol")).forEach(walk);
        return;
      }
      if ("children" in node) node.children?.forEach(walk);
    };
    walk(tree);
  };
}
