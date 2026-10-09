import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});

const state = vi.hoisted(() => ({
  hasKey: true,
  /** Scripted model turns; each is the final message of one stream. */
  turns: [] as object[],
  requests: [] as { messages: unknown[] }[],
  tools: [] as { name: string; wallet: string }[],
  /** Streams wait on this before replying (to hold a response open). */
  hold: Promise.resolve() as Promise<void>,
}));

vi.mock("@/server/agent/tools", async (importOriginal) => ({
  ...(await importOriginal<typeof AgentTools>()),
  runAgentTool: async (name: string, _input: unknown, wallet: string) => {
    state.tools.push({ name, wallet });
    return { content: '{"data":{"usdc":120,"sol":0.3},"reason":null}', isError: false };
  },
}));
vi.mock("@/server/agent/client", () => ({
  anthropic: () =>
    state.hasKey
      ? {
          beta: {
            messages: {
              stream(params: { messages: unknown[] }) {
                state.requests.push(structuredClone(params));
                const turn = state.turns.shift() as { content: { type: string; text?: string }[] };
                return {
                  async *[Symbol.asyncIterator]() {
                    await state.hold;
                    for (const [index, block] of turn.content.entries()) {
                      if (block.type === "text") {
                        yield {
                          type: "content_block_delta",
                          index,
                          delta: { type: "text_delta", text: block.text },
                        };
                        yield { type: "content_block_stop", index };
                      }
                    }
                  },
                  finalMessage: async () => turn,
                };
              },
            },
          },
        }
      : null,
}));

import type * as AgentTools from "@/server/agent/tools";

import { POST } from "./route";

const WALLET = "2bQ6SPX7mz5DHa7hunC9L1QUdGuHpLuKBNKA11MkFSeQ";
const message = (content: object[], stop_reason: string) => ({
  id: "m",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content,
  stop_reason,
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
});

let ip = 0;
const post = (body: object, sameClient = false) =>
  POST(
    new NextRequest("http://localhost/api/agent", {
      method: "POST",
      body: JSON.stringify(body),
      // A fresh client per request unless asked, so the rate limiter stays out of the way.
      headers: { "x-forwarded-for": sameClient ? "10.0.0.1" : `10.1.0.${++ip}` },
    }),
  );

/** Reads an SSE response into its events. */
async function events(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter(Boolean)
    .map(
      (chunk) =>
        JSON.parse(
          chunk
            .split("\n")
            .find((l) => l.startsWith("data: "))!
            .slice(6),
        ) as { type: string; [k: string]: unknown },
    );
}

beforeEach(() => {
  state.hasKey = true;
  state.turns = [];
  state.requests = [];
  state.tools = [];
  state.hold = Promise.resolve();
});

describe("POST /api/agent", () => {
  it("streams a reply, returns the history, and continues from it", async () => {
    state.turns = [
      message([{ type: "tool_use", id: "t1", name: "getWalletBalances", input: {} }], "tool_use"),
      message([{ type: "text", text: "You hold 120 USDC." }], "end_turn"),
    ];
    const response = await post({ wallet: WALLET, message: "What's my balance?" });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const first = await events(response);
    const types = first
      .map((e) => e.type)
      .filter((t, i, all) => t !== "text" || all[i - 1] !== "text");
    expect(types).toEqual(["tool", "tool_result", "text", "history", "done"]);
    expect(
      first
        .filter((e) => e.type === "text")
        .map((e) => e.delta)
        .join(""),
    ).toBe("You hold 120 USDC.");
    // Tools ran for the connected wallet.
    expect(state.tools).toEqual([{ name: "getWalletBalances", wallet: WALLET }]);

    const history = first.find((e) => e.type === "history")!.messages as unknown[];
    expect(history).toHaveLength(4); // user, tool_use, tool_result, answer

    state.turns = [message([{ type: "text", text: "Still 120." }], "end_turn")];
    await events(await post({ wallet: WALLET, message: "And now?", history }));
    // The model saw the whole history it was sent, then the new question.
    expect(state.requests.at(-1)!.messages).toHaveLength(5);
  });

  it("lets a guest (no wallet) research, answering wallet tools with 'connect a wallet'", async () => {
    state.turns = [
      message(
        [
          { type: "tool_use", id: "t1", name: "listStocks", input: {} },
          { type: "tool_use", id: "t2", name: "getWalletBalances", input: {} },
        ],
        "tool_use",
      ),
      message([{ type: "text", text: "Connect a wallet to see balances." }], "end_turn"),
    ];
    const all = await events(await post({ message: "What can I buy?" }));
    // Research tools ran (as "guest"); the wallet tool never reached a wallet.
    expect(state.tools).toEqual([{ name: "listStocks", wallet: "guest" }]);
    const balance = all.find((e) => e.type === "tool_result" && e.id === "t2")!;
    expect(String(balance.content)).toMatch(/No wallet is connected/);
    expect(all.at(-1)!.type).toBe("done");
  });

  it("validates the body and needs the API key", async () => {
    expect((await post({ wallet: WALLET, message: "" })).status).toBe(400);
    expect((await post({ wallet: "not-a-wallet", message: "hi" })).status).toBe(400);
    expect(
      (await post({ wallet: WALLET, message: "hi", history: [{ role: "system", content: "x" }] }))
        .status,
    ).toBe(400);
    state.hasKey = false;
    expect((await post({ wallet: WALLET, message: "hi" })).status).toBe(503);
  });

  it("allows one response at a time per client", async () => {
    state.turns = [message([{ type: "text", text: "slow" }], "end_turn")];
    let finish!: () => void;
    state.hold = new Promise((resolve) => (finish = resolve));
    const first = await post({ wallet: WALLET, message: "one" }, true);
    const second = await post({ wallet: WALLET, message: "two" }, true);
    expect(second.status).toBe(429);
    finish();
    await events(first);
  });
});
