import { memo, type ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Skeleton } from "@/components/ui/skeleton";
import { comparisonFallbackMarkdown, parseComparison } from "@/lib/markdown/comparison";
import { stableMarkdown } from "@/lib/markdown/streaming";
import { rehypeTableColumns } from "@/lib/markdown/table-columns";
import { cn } from "@/lib/utils";

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

const cellClass = (props: CellProps) =>
  cn(
    props["data-numeric"] && "text-right font-mono whitespace-nowrap",
    props["data-change"] === "up" && "text-success",
    props["data-change"] === "down" && "text-destructive",
  );

/** A ```comparison block: a live, sortable table, or a plain table if its JSON is invalid. */
function ComparisonBlock({ source }: { source: string }) {
  const comparison = parseComparison(source);
  if (comparison) return <ComparisonTable comparison={comparison} />;
  const fallback = comparisonFallbackMarkdown(source);
  if (fallback) return <MarkdownBody text={fallback} />;
  return (
    <p className="text-xs text-muted-foreground">This comparison couldn&apos;t be displayed.</p>
  );
}

const components: Components = {
  h1: ({ children }) => <h3 className="mt-5 text-base font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-5 text-base font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-4 font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-4 font-semibold first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-3 font-medium first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="mt-3 font-medium first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children, className }) => (
    <ul
      className={cn(
        "space-y-1 pl-5 marker:text-muted-foreground",
        // Task lists (- [ ] / - [x]) carry their own checkbox.
        className?.includes("contains-task-list") ? "list-none pl-1" : "list-disc",
      )}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">{children}</ol>
  ),
  li: ({ children, className }) => (
    <li
      className={cn(
        "pl-0.5",
        className?.includes("task-list-item") && "flex items-start gap-2 [&>input]:mt-1",
      )}
    >
      {children}
    </li>
  ),
  input: ({ type, checked }) =>
    type === "checkbox" ? (
      <input type="checkbox" checked={checked} disabled readOnly className="accent-primary" />
    ) : null,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  del: ({ children }) => <del className="text-muted-foreground">{children}</del>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary-text underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="space-y-2 border-l-2 border-primary/50 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border" />,
  pre: ({ children, node }) => {
    const code = (node as HastNode | undefined)?.children?.[0];
    const lang = code?.properties?.className;
    if (Array.isArray(lang) && lang.includes("language-comparison")) {
      return <ComparisonBlock source={hastText(code)} />;
    }
    return (
      <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
        {children}
      </pre>
    );
  },
  code: ({ className, children }) =>
    // Fenced blocks carry a language class (or sit in <pre>, styled above); inline code gets a chip.
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
  table: ({ children }) => (
    // Scrolls inside its own box on narrow screens, never widening the chat.
    <div className="max-h-[28rem] max-w-full overflow-auto rounded-lg border">
      <table className="w-full border-collapse text-xs tabular-nums sm:text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="sticky top-0 z-10 bg-muted">{children}</thead>,
  tbody: ({ children }) => (
    <tbody className="[&>tr]:border-t [&>tr]:border-border [&>tr]:transition-colors [&>tr:hover]:bg-muted/60 [&>tr:nth-child(even)]:bg-muted/30">
      {children}
    </tbody>
  ),
  // Alignment comes from the column (rehypeTableColumns), not GFM's ":" markers alone.
  th: ({ children, style, ...props }) => (
    <th
      scope="col"
      style={style}
      className={cn(
        "px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground",
        (props as CellProps)["data-numeric"] && "text-right",
      )}
    >
      {children}
    </th>
  ),
  td: ({ children, style, ...props }) => (
    <td style={style} className={cn("px-3 py-2 align-top", cellClass(props as CellProps))}>
      {children}
    </td>
  ),
};

const remarkPlugins: ComponentProps<typeof ReactMarkdown>["remarkPlugins"] = [remarkGfm];
const rehypePlugins: ComponentProps<typeof ReactMarkdown>["rehypePlugins"] = [rehypeTableColumns];

const MarkdownBody = memo(function MarkdownBody({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={components}
      skipHtml
    >
      {text}
    </ReactMarkdown>
  );
});

function PendingTable({ label }: { label: string }) {
  return (
    <div className="space-y-2 rounded-lg border p-3" role="status" aria-label={label}>
      <Skeleton className="h-4 w-full" />
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
export function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const stable = stableMarkdown(text, streaming);
  return (
    <div className="min-w-0 space-y-3 break-words">
      <MarkdownBody text={stable.text} />
      {stable.pending === "comparison" && <PendingTable label="Loading comparison" />}
      {stable.pending === "table" && <PendingTable label="Loading table" />}
    </div>
  );
}
