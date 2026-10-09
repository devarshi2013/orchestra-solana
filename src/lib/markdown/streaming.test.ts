import { describe, expect, it } from "vitest";

import { stableMarkdown } from "./streaming";

const TABLE =
  "Intro:\n\n| Company | Price |\n|---|---:|\n| Apple | $182.45 |\n| NVIDIA | $120.10 |\n";

describe("stableMarkdown", () => {
  it("leaves finished text alone", () => {
    expect(stableMarkdown("| a\n**b", false)).toEqual({ text: "| a\n**b", pending: null });
  });

  it("holds back a table until its delimiter row has arrived", () => {
    expect(stableMarkdown("Intro:\n\n| Company | Price |\n", true)).toEqual({
      text: "Intro:\n",
      pending: "table",
    });
    expect(stableMarkdown("Intro:\n\n| Company | Price |\n|---|-", true)).toEqual({
      text: "Intro:\n",
      pending: "table",
    });
    expect(stableMarkdown("Intro:\n\n| Comp", true).pending).toBe("table");
  });

  it("holds back a half-received row but shows the rows before it", () => {
    const cut = TABLE.slice(0, TABLE.indexOf("$120") + 2);
    const out = stableMarkdown(cut, true);
    expect(out.pending).toBe("row");
    expect(out.text).toContain("| Apple | $182.45 |");
    expect(out.text).not.toContain("NVIDIA");
  });

  it("hides an unmatched ** in the line still arriving", () => {
    expect(stableMarkdown("Done.\n- **NVDA** and **AA", true).text).toBe("Done.\n- **NVDA** and ");
  });

  it("holds back an unfinished comparison block and any fence still being typed", () => {
    expect(stableMarkdown('Intro\n\n```comparison\n{"rows": [', true)).toEqual({
      text: "Intro\n",
      pending: "comparison",
    });
    expect(stableMarkdown("Intro\n\n```compa", true).text).toBe("Intro\n");
    const done = 'Intro\n\n```comparison\n{"rows": []}\n```\n\nAfter';
    expect(stableMarkdown(done, true)).toEqual({ text: done, pending: null });
  });
});
