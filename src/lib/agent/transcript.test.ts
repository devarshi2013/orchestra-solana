import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";

import {
  conversationTitle,
  displayToolResult,
  MAX_DISPLAYED_RESULT,
  transcriptOf,
} from "./transcript";

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;

const plan = {
  items: [
    {
      kind: "crypto",
      ticker: "SOL",
      usdcAmount: 50,
      reason: "Highest 1Y return",
      symbol: "SOL",
      name: "Solana",
    },
  ],
  totalUsdc: 50,
  rankingMethod: "1Y return",
};

describe("transcriptOf", () => {
  it("replays questions, answers, the data used and the accepted plan", () => {
    const history = [
      { role: "user", content: "Invest 50 USDC" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "text", text: "Checking. " },
          { type: "tool_use", id: "t1", name: "getWalletBalances", input: {} },
          { type: "tool_use", id: "t2", name: "listAssets", input: { kind: "crypto" } },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "t1",
            content: '{"data":{"usdc":80}}',
            is_error: false,
          },
          { type: "tool_result", tool_use_id: "t2", content: "boom", is_error: true },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "p1", name: "submit_plan", input: { items: [] } }],
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: "p1",
            content: JSON.stringify({ accepted: true, plan }),
            is_error: false,
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "Here's the plan." }] },
      { role: "user", content: "Thanks" },
    ] as MessageParam[];

    const turns = transcriptOf(history);
    expect(turns).toHaveLength(3);
    expect(turns[0]).toEqual({ role: "user", text: "Invest 50 USDC" });
    expect(turns[1]).toMatchObject({
      role: "assistant",
      text: "Checking. Here's the plan.",
      plan,
    });
    const tools = turns[1]!.role === "assistant" ? turns[1]!.tools : [];
    expect(tools.map((t) => [t.name, t.ok, t.result])).toEqual([
      ["getWalletBalances", true, '{"data":{"usdc":80}}'],
      ["listAssets", false, "boom"],
      ["submit_plan", true, JSON.stringify({ accepted: true, plan })],
    ]);
    expect(turns[2]).toEqual({ role: "user", text: "Thanks" });
  });

  it("shows no plan for a rejected submission, and redacts addresses", () => {
    const turns = transcriptOf([
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Mint XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp" },
          { type: "tool_use", id: "p1", name: "submit_plan", input: {} },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "p1", content: '{"accepted":false}', is_error: true },
        ],
      },
    ] as MessageParam[]);
    expect(turns[1]).toMatchObject({ text: "Mint [address removed]", plan: null });
  });
});

describe("displayToolResult", () => {
  it("cuts very long results", () => {
    const shown = displayToolResult("x".repeat(MAX_DISPLAYED_RESULT + 5));
    expect(shown).toMatch(/\(cut: 5 more characters\)$/);
  });
});

describe("conversationTitle", () => {
  it("is the first question on one line, shortened", () => {
    expect(conversationTitle("  Invest\n 50   USDC ")).toBe("Invest 50 USDC");
    expect(conversationTitle("a".repeat(100))).toHaveLength(80);
  });
});
