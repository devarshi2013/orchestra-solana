import { memo, useMemo, type ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Skeleton } from "@/components/ui/skeleton";
import { rehypeBuyable, type Buyable } from "@/lib/assistant/buyable";
import { comparisonFallbackMarkdown, parseComparison } from "@/lib/markdown/comparison";
import { stableMarkdown } from "@/lib/markdown/streaming";
import { rehypeTableColumns } from "@/lib/markdown/table-columns";
import { cn } from "@/lib/utils";

import { BuyPill, BuyRow, BuySlot } from "./buy";
import { ComparisonTable } from "./comparison-table";

type HastNode = {
  type: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};
const hastText = (node: HastNode | undefined): string =>
  !node
    ? ""
    : node.type === "text"
      ? (node.value ?? "")
      : (node.children ?? []).map(hastText).join("");

/** Cell props set by rehypeTableColumns. */
type CellProps = { "data-numeric"?: string; "data-change"?: "up" | "down" | "flat" };
/** Block and row props set by rehypeBuyable. */
type BuyProps = { "data-buy-id"?: string; "data-buy-name"?: string };
/** The marks rehypeBuyable adds. */
type BuyMark = { id: string; name: string };

const cellClass = (props: CellProps) =>
  cn(
    props["data-numeric"] && "text-right font-medium whitespace-nowrap tabular-nums",
    props["data-change"] === "up" && "text-green-800",
    props["data-change"] === "down" && "text-red-800",
  );

/** A ```comparison block: a live, sortable table, or a plain table if its JSON is invalid. */
function ComparisonBlock({ source }: { source: string }) {
  const comparison = parseComparison(source);
  if (comparison) return <ComparisonTable comparison={comparison} />;
  const fallback = comparisonFallbackMarkdown(source);
  if (fallback) return <MarkdownBody text={fallback} />;
  return null;
}

/** Every heading level is the same small label: replies are short notes, not documents. */
const heading: Components["h1"] = ({ children }) => (
  <h3 className="mt-4 text-[15px] font-semibold text-text-extra-high first:mt-0">{children}</h3>
);

const components: Components = {
  h1: heading,
  h2: heading,
  h3: heading,
  h4: heading,
  h5: heading,
  h6: heading,
  p: ({ children, node: _node, ...props }) => {
    const { "data-buy-id": id, "data-buy-name": name } = props as BuyProps;
    return (
      <>
        <p>{children}</p>
        <BuySlot id={id} name={name} />
      </>
    );
  },
  ul: ({ children, className }) => (
    <ul
      className={cn(
        "space-y-0.5 pl-5 marker:text-ink-muted",
        // Task lists (- [ ] / - [x]) carry their own checkbox.
        className?.includes("contains-task-list") ? "list-none pl-1" : "list-disc",
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-0.5 pl-5 marker:text-ink-muted">{children}</ol>
  ),
  li: ({ children, className, node: _node, ...props }) => {
    const { "data-buy-id": id, "data-buy-name": name } = props as BuyProps;
    return (
      <li
        className={cn(
          "pl-0.5",
          className?.includes("task-list-item") && "flex items-start gap-2 [&>input]:mt-1",
        )}
      >
        {children}
        <BuySlot id={id} name={name} />
      </li>
    );
  },
  input: ({ type, checked }) =>
    type === "checkbox" ? (
      <input type="checkbox" checked={checked} disabled readOnly className="accent-gray-1400" />
    ) : null,
  strong: ({ children }) => (
    <strong className="font-semibold text-text-extra-high">{children}</strong>
  ),
  del: ({ children }) => <del className="text-ink-muted">{children}</del>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium link-inline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="space-y-2 border-l-2 border-soft-strong pl-3 text-text-medium">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-soft-strong" />,
  pre: ({ children, node }) => {
    const code = (node as HastNode | undefined)?.children?.[0];
    const lang = code?.properties?.className;
    if (Array.isArray(lang) && lang.includes("language-comparison")) {
      return <ComparisonBlock source={hastText(code)} />;
    }
    return (
      <pre className="overflow-x-auto rounded-[12px] bg-soft p-3 font-mono text-[12.5px] leading-relaxed text-text-high">
        {children}
      </pre>
    );
  },
  code: ({ className, children }) =>
    // Fenced blocks carry a language class (or sit in <pre>, styled above); inline code gets a chip.
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded-[6px] bg-soft px-1 py-0.5 font-mono text-[0.85em] text-text-extra-high">
        {children}
      </code>
    ),
  table: ({ children }) => (
    // Scrolls inside its own box on narrow screens, never widening the chat.
    <div className="max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-[14px] tabular-nums">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-soft-strong">{children}</thead>,
  tr: ({ children, node: _node, ...props }) => {
    const { "data-buy-id": id, "data-buy-name": name } = props as BuyProps;
    return (
      <>
        <tr className="group/row">{children}</tr>
        <BuyRow id={id} name={name} />
      </>
    );
  },
  tbody: ({ children }) => <tbody className="divide-y divide-soft">{children}</tbody>,
  // Alignment comes from the column (rehypeTableColumns), not GFM's ":" markers alone.
  th: ({ children, style, ...props }) => (
    <th
      scope="col"
      style={style}
      className={cn(
        "py-2 pr-4 text-left text-[12.5px] font-medium whitespace-nowrap text-ink-muted last:pr-0",
        (props as CellProps)["data-numeric"] && "text-right",
      )}
    >
      {children}
    </th>
  ),
  td: ({ children, style, ...props }) => (
    <td
      style={style}
      className={cn("py-2 pr-4 align-top last:pr-0", cellClass(props as CellProps))}
    >
      {children}
    </td>
  ),
};

// Marks from rehypeBuyable: a pill after a token's first mention, and one at a row's end.
Object.assign(components, {
  "buy-mention": ({ id, name }: BuyMark) => (
    <BuyPill id={id} name={name} className="-my-1 ml-1.5 h-6" />
  ),
  "buy-cell": ({ id, name }: BuyMark) => (
    <td className="w-px py-2 pl-3 text-right whitespace-nowrap">
      <BuyPill
        id={id}
        name={name}
        className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
      />
    </td>
  ),
});

const remarkPlugins: ComponentProps<typeof ReactMarkdown>["remarkPlugins"] = [remarkGfm];
type RehypePlugins = ComponentProps<typeof ReactMarkdown>["rehypePlugins"];
const rehypePlugins: RehypePlugins = [rehypeTableColumns];

const MarkdownBody = memo(function MarkdownBody({
  text,
  buyable,
}: {
  text: string;
  buyable?: Buyable;
}) {
  const plugins = useMemo<RehypePlugins>(
    () => (buyable?.size ? [rehypeTableColumns, rehypeBuyable(buyable)] : rehypePlugins),
    [buyable],
  );
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={plugins}
      components={components}
      skipHtml
    >
      {text}
    </ReactMarkdown>
  );
});

function PendingTable({ label }: { label: string }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-11/12" />
      <Skeleton className="h-3.5 w-4/5" />
    </div>
  );
}

/**
 * The assistant's replies as GitHub-flavoured Markdown: headings, lists, task
 * lists, bold, strikethrough, links (new tab), code, real tables, and
 * ```comparison blocks as live tables. Raw HTML in the text is dropped and
 * unsafe link protocols are stripped. While `streaming`, half-received tables
 * and blocks are held back (with a placeholder) so raw syntax never flashes.
 */
export function Markdown({
  text,
  streaming = false,
  buyable,
}: {
  text: string;
  streaming?: boolean;
  /** Tokens this reply's tool results returned: they get a Buy pill. */
  buyable?: Buyable;
}) {
  const stable = stableMarkdown(text, streaming);
  return (
    <div className="min-w-0 space-y-2.5 break-words">
      <MarkdownBody text={stable.text} buyable={buyable} />
      {stable.pending === "comparison" && <PendingTable label="Loading comparison" />}
      {stable.pending === "table" && <PendingTable label="Loading table" />}
    </div>
  );
}
