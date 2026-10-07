import { describe, expect, it } from "vitest";

import { createAddressRedactor, REDACTED, redactAddresses } from "./redact";

const MINT = "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp";

describe("address redaction", () => {
  it("removes address-shaped tokens, keeping punctuation and ordinary words", () => {
    expect(redactAddresses(`Buy AAPLx (${MINT}), not ${MINT}.`)).toBe(
      `Buy AAPLx (${REDACTED}), not ${REDACTED}.`,
    );
    expect(redactAddresses("SOL returned 12.27% over 30D; NVDAx P/E 41.3")).toBe(
      "SOL returned 12.27% over 30D; NVDAx P/E 41.3",
    );
  });

  it("works across arbitrary stream chunk boundaries", () => {
    const text = `The mint is ${MINT} and\nthe wallet is 2bQ6SPX7mz5DHa7hunC9L1QUdGuHpLuKBNKA11MkFSeQ done`;
    for (const size of [1, 3, 7, 50]) {
      const redactor = createAddressRedactor();
      let out = "";
      for (let i = 0; i < text.length; i += size) out += redactor.push(text.slice(i, i + size));
      out += redactor.flush();
      expect(out).toBe(`The mint is ${REDACTED} and\nthe wallet is ${REDACTED} done`);
    }
  });

  it("holds back only the unfinished word", () => {
    const redactor = createAddressRedactor();
    expect(redactor.push("Hello wor")).toBe("Hello ");
    expect(redactor.push("ld")).toBe("");
    expect(redactor.flush()).toBe("world");
  });
});
