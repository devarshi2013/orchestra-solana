import { describe, expect, it } from "vitest";

import { displayToolResult, MAX_DISPLAYED_RESULT } from "./transcript";

describe("displayToolResult", () => {
  it("redacts addresses inside JSON results", () => {
    expect(displayToolResult('{"mint":"XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp"}')).toBe(
      '{"mint":"[address removed]"}',
    );
  });

  it("cuts very long results", () => {
    const shown = displayToolResult("x".repeat(MAX_DISPLAYED_RESULT + 5));
    expect(shown).toMatch(/\(cut: 5 more characters\)$/);
  });
});
