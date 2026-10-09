import { describe, expect, it, vi } from "vitest";

import { generateTitle, TITLE_MODEL } from "./title";

const client = (text: string) => ({
  messages: {
    create: vi.fn(async () => ({ content: [{ type: "text", text }] }) as never),
  },
});

describe("generateTitle", () => {
  it("asks the small model for a title and cleans it", async () => {
    const fake = client('"Comparing NVDA and AMD."');
    expect(await generateTitle(fake, "Compare NVDA and AMD", "Here's how they compare")).toBe(
      "Comparing NVDA and AMD",
    );
    expect(fake.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: TITLE_MODEL, max_tokens: 32 }),
      expect.anything(),
    );
  });

  it("returns null for an unusable answer or one with an address", async () => {
    expect(
      await generateTitle(
        client("Sure! Here is a title you could use for this chat about stocks"),
        "x",
        "",
      ),
    ).toBeNull();
    expect(
      await generateTitle(client("Buy Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"), "x", ""),
    ).toBeNull();
  });
});
