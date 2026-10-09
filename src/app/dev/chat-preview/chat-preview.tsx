"use client";

import { FIXTURES } from "@/components/assistant/markdown.fixtures";
import { Markdown } from "@/components/assistant/markdown";

const table = FIXTURES.threeStocks;
const headerOnly = table.slice(0, table.indexOf("|---"));
const midRow = table.slice(0, table.indexOf("| Apple") + "| Apple | AAPL | $23".length);

const SAMPLES: { title: string; text: string; streaming?: boolean }[] = [
  { title: "Two text blocks around a tool call", text: FIXTURES.splitBlocks.join("\n\n") },
  { title: "Streaming: header row received", text: headerOnly, streaming: true },
  { title: "Streaming: half a row received", text: midRow, streaming: true },
  {
    title: "Streaming: comparison block half received",
    text: FIXTURES.comparison.slice(0, FIXTURES.comparison.indexOf('"Apple"')),
    streaming: true,
  },
  { title: "3-stock comparison", text: FIXTURES.threeStocks },
  { title: "Negative numbers", text: FIXTURES.negatives },
  { title: "Long table", text: FIXTURES.longTable },
  { title: "Headings, lists and a table", text: FIXTURES.mixed },
  { title: "Structured comparison block", text: FIXTURES.comparison },
];

export function ChatPreview() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {SAMPLES.map((s) => (
        <section key={s.title} className="space-y-2">
          <h2 className="font-mono text-xs text-muted-foreground uppercase">{s.title}</h2>
          <div className="rounded-2xl border bg-card p-4 text-sm">
            <Markdown text={s.text} streaming={s.streaming} />
          </div>
        </section>
      ))}
    </main>
  );
}
