import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Markdown } from "./markdown";

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

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
});
