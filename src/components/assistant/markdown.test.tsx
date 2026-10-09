import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Markdown } from "./markdown";
import { chunk, FIXTURES } from "./markdown.fixtures";

const html = (text: string, streaming = false) =>
  renderToStaticMarkup(<Markdown text={text} streaming={streaming} />);
/** Text in paragraphs (outside tables): where a stray pipe would show as raw syntax. */
const paragraphs = (out: string) => [...out.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]!);

describe("Markdown", () => {
  it("renders GFM tables as real HTML tables, right-aligning numbers", () => {
    const out = html(
      [
        "| Stock | Market cap ($B) | 1Y return (%) |",
        "| --- | ---: | ---: |",
        "| NVIDIA | 4,512.3 | 38.2% |",
        "| Apple | 3,401.0 | -4.1% |",
      ].join("\n"),
    );
    expect(out).toContain("<table");
    expect(out).toContain("<thead");
    expect(out.match(/<tr/g)).toHaveLength(3);
    expect(out).toMatch(/<td[^>]*text-right[^>]*>4,512.3<\/td>/);
    expect(out).toMatch(/<td[^>]*>NVIDIA<\/td>/);
    expect(out).not.toMatch(/<td[^>]*text-right[^>]*>NVIDIA/);
    expect(out).toContain("overflow-auto");
  });

  it("renders headings, bold, lists, code and safe links", () => {
    const out = html(
      "## Plan\n\n**Bold** and `code`\n\n- one\n- two\n\n1. first\n\n[Solscan](https://solscan.io/tx/abc)",
    );
    expect(out).toContain("<h3");
    expect(out).toContain("<strong");
    expect(out).toContain("<ul");
    expect(out).toContain("<ol");
    expect(out).toContain("<code");
    expect(out).toMatch(
      /<a href="https:\/\/solscan.io\/tx\/abc" target="_blank" rel="noopener noreferrer"/,
    );
  });

  it("never renders raw HTML or javascript: links", () => {
    const out = html('<img src=x onerror="alert(1)"> [x](javascript:alert(1))');
    expect(out).not.toContain("<img");
    expect(out).not.toContain("javascript:");
  });

  it("renders a 3-stock comparison with right-aligned numeric columns and coloured returns", () => {
    const out = html(FIXTURES.threeStocks);
    expect(out.match(/<tr/g)).toHaveLength(4);
    expect(out).toMatch(/<th[^>]*text-right[^>]*>Price<\/th>/);
    expect(out).toMatch(/<th[^>]*text-left[^>]*>Company<\/th>/);
    expect(out).toMatch(/<td[^>]*text-right[^>]*>\$182.45<\/td>/);
    expect(out).toMatch(/<td[^>]*text-success[^>]*>\+38.2%<\/td>/);
    // P/E is numeric but not a change: right-aligned, never coloured.
    expect(out).toMatch(/<td[^>]*class="[^"]*text-right[^"]*">52.1<\/td>/);
    expect(out).not.toMatch(/text-success[^>]*>52.1/);
  });

  it("colours negative changes red with a true minus sign, and zero neutral", () => {
    const out = html(FIXTURES.negatives);
    expect(out).toMatch(/<td[^>]*text-destructive[^>]*>−12.9%<\/td>/);
    expect(out).toMatch(/<td[^>]*text-destructive[^>]*>−4.0%<\/td>/);
    expect(out).toMatch(/<td[^>]*text-success[^>]*>\+1.1%<\/td>/);
    expect(out).toMatch(/<td[^>]*class="[^"]*text-right[^"]*">0.0%<\/td>/);
    expect(out).not.toContain("-12.9%");
  });

  it("keeps a long table inside its own scroll box", () => {
    const out = html(FIXTURES.longTable);
    expect(out).toMatch(/<div class="[^"]*max-w-full[^"]*overflow-auto[^"]*"><table/);
    expect(out).toMatch(/<td[^>]*text-right[^>]*>\$1,201.33<\/td>/);
  });

  it("renders mixed headings, lists, a table, a quote and a link", () => {
    const out = html(FIXTURES.mixed);
    expect(out).toContain("<h3");
    expect(out).toContain("<h4");
    expect(out).toContain("<ol");
    expect(out).toContain("<blockquote");
    expect(out).toContain("<table");
    expect(out).toContain('target="_blank"');
    for (const p of paragraphs(out)) expect(p).not.toContain("|");
  });

  it("renders strikethrough and task lists", () => {
    const out = html("~~old~~ new\n\n- [x] checked balance\n- [ ] quote");
    expect(out).toContain("<del");
    expect(out.match(/type="checkbox"/g)).toHaveLength(2);
  });

  it("parses a table after a tool call once text blocks are separated", () => {
    expect(html(FIXTURES.splitBlocks.join("\n\n"))).toContain("<table");
  });

  it("never shows raw table syntax at any point while a table streams in", () => {
    for (const count of [7, 23, 61, 150]) {
      let received = "";
      for (const piece of chunk(FIXTURES.threeStocks, count)) {
        received += piece;
        const out = html(received, true);
        for (const p of paragraphs(out)) expect(p).not.toMatch(/\||---|\*\*/);
        // A row only appears once it's complete: no truncated "$18" prices.
        for (const cell of out.matchAll(/<td[^>]*>([^<]*)<\/td>/g)) {
          expect(FIXTURES.threeStocks).toContain(`| ${cell[1]} |`.replace("−", "-"));
        }
      }
    }
  });

  it("renders a comparison block as the comparison table", () => {
    const out = html(FIXTURES.comparison);
    expect(out).not.toContain("<pre");
    expect(out).toContain("Largest US tech companies by market cap");
    expect(out).toContain("$4.43T");
    expect(out).toContain("+38.2%");
    expect(out).toContain("−4.1%");
    expect(out).toMatch(/aria-sort="none"/);
  });

  it("shows a placeholder, not JSON, while a comparison block streams in", () => {
    const cut = FIXTURES.comparison.slice(0, FIXTURES.comparison.indexOf('"Apple"'));
    const out = html(cut, true);
    expect(out).not.toContain("NVIDIA");
    expect(out).toContain('aria-label="Loading comparison"');
  });

  it("falls back to a plain table when the comparison JSON is invalid", () => {
    const out = html('```comparison\n{"rows":[{"ticker":"NVDA","pe":"high"}]}\n```');
    expect(out).toContain("<table");
    expect(out).toContain("NVDA");
    expect(out).not.toContain("<pre");
  });
});
