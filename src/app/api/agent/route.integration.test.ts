import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL:
      process.env.DATABASE_URL ??
      "postgresql://orchestra:orchestra@localhost:5432/orchestra?schema=public",
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});

const state = vi.hoisted(() => ({
  wallet: "AgentTest1111111111111111111111111111111111" as string | null,
  hasKey: true,
  /** Scripted model turns; each is the final message of one stream. */
  turns: [] as object[],
  requests: [] as { messages: unknown[] }[],
  /** Streams wait on this before replying (to hold a response open). */
  hold: Promise.resolve() as Promise<void>,
}));

vi.mock("@/server/auth/session", () => ({ sessionWallet: async () => state.wallet }));
vi.mock("@/server/agent/tools", async (importOriginal) => ({
  ...(await importOriginal<typeof AgentTools>()),
  runAgentTool: async () => ({
    content: '{"data":{"usdc":120,"sol":0.3},"reason":null}',
    isError: false,
  }),
}));
vi.mock("@/server/assets/registry", () => ({ getRegistry: vi.fn() }));
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
import { db } from "@/server/db";

import { GET as getConversation } from "../assistant/conversations/[id]/route";
import { GET as listConversations } from "../assistant/conversations/route";
import { POST } from "./route";

const message = (content: object[], stop_reason: string) => ({
  id: "m",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content,
  stop_reason,
  usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
});

const post = (body: object) =>
  POST(
    new NextRequest("http://localhost/api/agent", { method: "POST", body: JSON.stringify(body) }),
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

beforeEach(async () => {
  state.wallet = "AgentTest1111111111111111111111111111111111";
  state.hasKey = true;
  state.turns = [];
  state.requests = [];
  await db.assistantDisclosure.upsert({
    where: { owner: state.wallet },
    create: { owner: state.wallet, version: 1 },
    update: { version: 1 },
  });
});

afterAll(async () => {
  await db.agentConversation.deleteMany({ where: { owner: { startsWith: "AgentTest" } } });
  await db.assistantDisclosure.deleteMany({ where: { owner: { startsWith: "AgentTest" } } });
  await db.$disconnect();
});

describe("POST /api/agent", () => {
  it("streams a reply as SSE, stores the conversation, and continues it", async () => {
    state.turns = [
      message([{ type: "tool_use", id: "t1", name: "getWalletBalances", input: {} }], "tool_use"),
      message([{ type: "text", text: "You hold 120 USDC." }], "end_turn"),
    ];
    const response = await post({ message: "What's my balance?" });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const first = await events(response);
    // Consecutive text deltas collapse into one (the redactor streams word by word).
    const types = first
      .map((e) => e.type)
      .filter((t, i, all) => t !== "text" || all[i - 1] !== "text");
    expect(types).toEqual(["conversation", "tool", "tool_result", "text", "done"]);
    const reply = first.filter((e) => e.type === "text").map((e) => e.delta);
    expect(reply.join("")).toBe("You hold 120 USDC.");

    const result = first.find((e) => e.type === "tool_result")!;
    expect(result).toMatchObject({
      id: "t1",
      ok: true,
      content: expect.stringContaining('"usdc":120'),
    });

    const id = first[0]!.id as string;
    const stored = await db.agentConversation.findUniqueOrThrow({ where: { id } });
    expect(stored.owner).toBe(state.wallet);
    expect(stored.title).toBe("What's my balance?");
    expect(stored.messages).toHaveLength(4); // user, tool_use, tool_result, answer

    state.turns = [message([{ type: "text", text: "Still 120." }], "end_turn")];
    await events(await post({ conversationId: id, message: "And now?" }));
    // The model saw the whole stored history, then the new question.
    expect(state.requests.at(-1)!.messages).toHaveLength(5);
    expect((await db.agentConversation.findUniqueOrThrow({ where: { id } })).messages).toHaveLength(
      6,
    );

    // History lists it, and reopening replays it with the data used.
    const list = (await (await listConversations()).json()) as { id: string; title: string }[];
    expect(list.find((c) => c.id === id)?.title).toBe("What's my balance?");
    const transcript = (await (
      await getConversation(new NextRequest(`http://localhost/api/assistant/conversations/${id}`), {
        params: Promise.resolve({ id }),
      })
    ).json()) as {
      turns: { role: string; text: string; tools?: { name: string; result: string }[] }[];
    };
    expect(transcript.turns.map((t) => t.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(transcript.turns[1]).toMatchObject({
      text: "You hold 120 USDC.",
      tools: [{ name: "getWalletBalances", result: expect.stringContaining("120") }],
    });
  });

  it("requires the one-time risk disclosure", async () => {
    await db.assistantDisclosure.delete({ where: { owner: state.wallet! } });
    const response = await post({ message: "hi" });
    expect(response.status).toBe(403);
  });

  it("refuses other wallets' conversations, signed-out users, and a missing key", async () => {
    state.turns = [message([{ type: "text", text: "hi" }], "end_turn")];
    const id = (await events(await post({ message: "hi" })))[0]!.id as string;

    state.wallet = "AgentTest2222222222222222222222222222222222";
    await db.assistantDisclosure.create({ data: { owner: state.wallet, version: 1 } });
    expect((await post({ conversationId: id, message: "peek" })).status).toBe(404);
    const peek = await getConversation(
      new NextRequest(`http://localhost/api/assistant/conversations/${id}`),
      { params: Promise.resolve({ id }) },
    );
    expect(peek.status).toBe(404);
    state.wallet = null;
    expect((await post({ message: "hi" })).status).toBe(401);
    state.wallet = "AgentTest1111111111111111111111111111111111";
    state.hasKey = false;
    expect((await post({ message: "hi" })).status).toBe(503);
    state.hasKey = true;
    expect((await post({ message: "" })).status).toBe(400);
  });

  it("allows one response at a time per wallet", async () => {
    state.turns = [message([{ type: "text", text: "slow" }], "end_turn")];
    let finish!: () => void;
    state.hold = new Promise((resolve) => (finish = resolve));
    const first = await post({ message: "one" });
    const second = await post({ message: "two" }); // first still answering
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("5");
    finish();
    await events(first);
    state.turns = [message([{ type: "text", text: "ok" }], "end_turn")];
    expect((await post({ message: "three" })).status).toBe(200);
  });
});
