import { Children, isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** The plain text inside rendered children (for spotting numeric cells). */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Prices, amounts, percentages, multiples: "$1,234.56", "-0.12%", "3.2T", "45.1x", "n/a". */
const NUMERIC = /^[\s(+−-]*[$€£]?\s?[\d.,]+\s?(%|[KMBT]|x|bps|USDC|SOL)?\)?\s*$|^(n\/a|—|-)$/i;
const isNumeric = (children: ReactNode) => {
  const text = textOf(Children.toArray(children)).trim();
  return text !== "" && NUMERIC.test(text);
};

const components: Components = {
  h1: ({ children }) => <h3 className="mt-4 text-base font-semibold first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 text-base font-semibold first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 font-semibold first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-3 font-semibold first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-5 marker:text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-5 marker:text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
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
    <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border" />,
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  ),
  code: ({ className, children }) =>
    // Fenced blocks carry a language class (or sit in <pre>, styled above); inline code gets a chip.
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
  table: ({ children }) => (
    // Scrolls sideways on narrow screens instead of overflowing the chat.
    <div className="max-h-[28rem] overflow-auto rounded-lg border">
      <table className="w-full border-collapse text-xs tabular-nums sm:text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="sticky top-0 z-10 bg-muted">{children}</thead>,
  tbody: ({ children }) => (
    <tbody className="[&>tr]:border-t [&>tr]:border-border [&>tr:nth-child(even)]:bg-muted/40">
      {children}
    </tbody>
  ),
  th: ({ children, style }) => (
    <th
      style={style}
      className={cn(
        "px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground",
        isNumeric(children) && "text-right",
      )}
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td
      style={style}
      className={cn(
        "px-3 py-2 align-top",
        isNumeric(children) && "text-right font-mono whitespace-nowrap",
      )}
    >
      {children}
    </td>
  ),
};

/**
 * The assistant's replies as GitHub-flavoured Markdown: headings, lists, bold,
 * links, code and real tables. Raw HTML in the text is not rendered, and
 * unsafe link protocols are stripped (react-markdown's defaults).
 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
