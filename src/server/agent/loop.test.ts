import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(process.env, {
    JUPITER_API_KEY: "jup_test_key",
    SOLANA_RPC_URL: "https://api.mainnet-beta.solana.com",
  });
});
// The loop only needs the tool definitions, not the tools' dependencies.

import type { AcceptedPlan } from "@/lib/agent/plan";

import {
  AGENT_MODEL,
  echoableContent,
  runAgentTurn,
  type AgentClient,
  type AgentEvent,
} from "./loop";
import type { ToolOutcome } from "./tools";

type Block = Anthropic.Beta.Messages.BetaContentBlock;
type Message = Anthropic.Beta.Messages.BetaMessage;
type Params = Parameters<AgentClient["beta"]["messages"]["stream"]>[0];

const text = (t: string) => ({ type: "text", text: t, citations: null }) as Block;
const thinking = (t: string) => ({ type: "thinking", thinking: t, signature: "sig" }) as Block;
const toolUse = (id: string, name: string, input: object) =>
  ({ type: "tool_use", id, name, input }) as Block;
const fallback = () =>
  ({
    type: "fallback",
    from: { model: AGENT_MODEL },
    to: { model: "claude-opus-4-8" },
  }) as unknown as Block;

const message = (content: Block[], stop_reason: Message["stop_reason"]): Message =>
  ({
    id: "msg",
    type: "message",
    role: "assistant",
    model: AGENT_MODEL,
    content,
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 80 },
  }) as unknown as Message;

/** A fake streaming client: each call replays the next scripted turn as stream events. */
function fakeClient(turns: (Message | "json-error" | Error)[]) {
  const calls: Params[] = [];
  const client: AgentClient = {
    beta: {
      messages: {
        stream(params) {
          calls.push(structuredClone(params));
          const turn = turns.shift();
          if (!turn) throw new Error("no more scripted turns");
          return {
            async *[Symbol.asyncIterator]() {
              if (turn instanceof Error) throw turn;
              if (turn === "json-error") return;
              for (const [index, block] of turn.content.entries()) {
                yield { type: "content_block_start", index, content_block: block } as never;
                if (block.type === "text") {
                  for (const piece of block.text.match(/.{1,5}/gs) ?? []) {
                    yield {
                      type: "content_block_delta",
                      index,
                      delta: { type: "text_delta", text: piece },
                    } as never;
                  }
                }
                if (block.type === "thinking") {
                  yield {
                    type: "content_block_delta",
                    index,
                    delta: { type: "thinking_delta", thinking: block.thinking },
                  } as never;
                }
                yield { type: "content_block_stop", index } as never;
              }
            },
            async finalMessage() {
              if (turn === "json-error") throw new SyntaxError("Unexpected end of JSON input");
              if (turn instanceof Error) throw turn;
              return turn;
            },
          };
        },
      },
    },
  };
  return { client, calls };
}

const plan: AcceptedPlan = {
  items: [
    {
      kind: "stock",
      ticker: "NVDA",
      usdcAmount: 50,
      reason: "Highest 1Y return",
      symbol: "NVDAx",
      name: "NVIDIA",
    },
  ],
  totalUsdc: 50,
  rankingMethod: "best 1Y return with liquidity above $5M",
};

async function run(
  turns: Parameters<typeof fakeClient>[0],
  runTool?: (name: string, input: unknown) => Promise<ToolOutcome>,
) {
  const { client, calls } = fakeClient(turns);
  const events: AgentEvent[] = [];
  const tool = vi.fn(
    runTool ?? (async () => ({ content: '{"data":{"usdc":100},"reason":null}', isError: false })),
  );
  const result = await runAgentTurn({
    client,
    history: [],
    userText: "Invest 50 USDC",
    runTool: tool,
    emit: (e) => events.push(e),
  });
  const textOut = events.flatMap((e) => (e.type === "text" ? [e.delta] : [])).join("");
  return { result, events, calls, tool, textOut };
}

describe("runAgentTurn", () => {
  it("streams a plain answer and stores the exchange", async () => {
    const { result, textOut, calls } = await run([
      message([text("Which budget do you have in mind?")], "end_turn"),
    ]);
    expect(textOut).toBe("Which budget do you have in mind?");
    expect(result.history).toEqual([
      { role: "user", content: "Invest 50 USDC" },
      { role: "assistant", content: [text("Which budget do you have in mind?")] },
    ]);
    expect(result.usage).toEqual({
      modelCalls: 1,
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 80,
    });
    expect(calls[0]).toMatchObject({
      model: "claude-opus-5-5",
      thinking: { type: "adaptive", display: "updates" },
      output_config: { effort: "high" },
      fallbacks: "default",
      betas: ["server-side-fallback-2026-07-01", "thinking-display-updates-2026-08-18"],
    });
    expect(
      calls[0]!.tools!.every((t) => "eager_input_streaming" in t && t.eager_input_streaming),
    ).toBe(true);
  });

  it("runs every tool call of a turn and returns all results in one message", async () => {
    const { result, tool, events } = await run([
      message(
        [
          thinking("Checking the wallet and the stocks."),
          toolUse("t1", "getWalletBalances", {}),
          toolUse("t2", "listStocks", { sector: "Technology" }),
        ],
        "tool_use",
      ),
      message([text("You have 100 USDC.")], "end_turn"),
    ]);
    expect(tool.mock.calls).toEqual([
      ["getWalletBalances", {}],
      ["listStocks", { sector: "Technology" }],
    ]);
    expect(result.history[2]).toEqual({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "t1",
          content: '{"data":{"usdc":100},"reason":null}',
          is_error: false,
        },
        {
          type: "tool_result",
          tool_use_id: "t2",
          content: '{"data":{"usdc":100},"reason":null}',
          is_error: false,
        },
      ],
    });
    // The thinking block is echoed back unchanged (preserved thinking).
    expect((result.history[1] as { content: Block[] }).content[0]).toEqual(
      thinking("Checking the wallet and the stocks."),
    );
    expect(events).toContainEqual({
      type: "progress",
      text: "Checking the wallet and the stocks.",
    });
    expect(events.filter((e) => e.type === "tool").map((e) => e.type === "tool" && e.name)).toEqual(
      ["getWalletBalances", "listStocks"],
    );
    // Each result streams with its call's id, for the "data used" panel.
    expect(events).toContainEqual({
      type: "tool_result",
      id: "t1",
      name: "getWalletBalances",
      ok: true,
      content: '{"data":{"usdc":100},"reason":null}',
    });
  });

  it("redacts addresses in streamed tool results", async () => {
    const { events, result } = await run(
      [message([toolUse("t1", "listStocks", {})], "tool_use"), message([text("ok")], "end_turn")],
      async () => ({
        content: '{"note":"XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp"}',
        isError: false,
      }),
    );
    const streamed = events.find((e) => e.type === "tool_result");
    expect(streamed).toMatchObject({ content: '{"note":"[address removed]"}' });
    // The model itself got the result unchanged.
    expect(JSON.stringify(result.history[2])).toContain(
      "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    );
  });

  it("sends a rejected plan back as an error to fix, then accepts the corrected one", async () => {
    let attempt = 0;
    const { result, events } = await run(
      [
        message([toolUse("p1", "submit_plan", { items: [] })], "tool_use"),
        message([toolUse("p2", "submit_plan", { items: [] })], "tool_use"),
        message([text("Done. This is research, not financial advice.")], "end_turn"),
      ],
      async (name) => {
        expect(name).toBe("submit_plan");
        return ++attempt === 1
          ? {
              content:
                '{"accepted":false,"errors":["\\"DOGE\\" is not a stock in the asset registry"]}',
              isError: true,
            }
          : { content: '{"accepted":true}', isError: false, plan };
      },
    );
    expect(result.history[2]).toMatchObject({ content: [{ tool_use_id: "p1", is_error: true }] });
    expect(result.plan).toEqual(plan);
    expect(events.filter((e) => e.type === "plan")).toEqual([{ type: "plan", plan }]);
  });

  it("tells the model to stop after repeated invalid plans", async () => {
    const { result } = await run(
      [
        message([toolUse("p1", "submit_plan", {})], "tool_use"),
        message([toolUse("p2", "submit_plan", {})], "tool_use"),
        message([toolUse("p3", "submit_plan", {})], "tool_use"),
        message([text("I couldn't build a valid plan: your wallet holds 5 USDC.")], "end_turn"),
      ],
      async () => ({
        content: '{"accepted":false,"errors":["exceeds the wallet"]}',
        isError: true,
      }),
    );
    const third = result.history[6] as { content: { content: string }[] };
    expect(JSON.parse(third.content[0]!.content)).toMatchObject({
      instruction: expect.stringContaining("Stop submitting"),
    });
    expect(result.plan).toBeNull();
  });

  it("stops on a refusal without running that turn's tools", async () => {
    const { result, tool, events } = await run([
      message([toolUse("t1", "listStocks", {})], "refusal"),
    ]);
    expect(tool).not.toHaveBeenCalled();
    expect(events).toContainEqual({
      type: "error",
      message: "The assistant declined to answer this request.",
    });
    expect(result.history).toEqual([{ role: "user", content: "Invest 50 USDC" }]);
  });

  it("drops the declined model's tool calls after a fallback and runs only the fallback's", async () => {
    const { tool, result } = await run([
      message(
        [
          text("Let me check. "),
          toolUse("old", "listStocks", {}),
          fallback(),
          toolUse("new", "getWalletBalances", {}),
        ],
        "tool_use",
      ),
      message([text("ok")], "end_turn"),
    ]);
    expect(tool.mock.calls.map(([name]) => name)).toEqual(["getWalletBalances"]);
    expect((result.history[1] as { content: Block[] }).content.map((b) => b.type)).toEqual([
      "text",
      "fallback",
      "tool_use",
    ]);
  });

  it("redacts address-shaped text before it reaches the client", async () => {
    const { textOut } = await run([
      message(
        [text("Buy NVDAx (mint XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp) now.")],
        "end_turn",
      ),
    ]);
    expect(textOut).toBe("Buy NVDAx (mint [address removed]) now.");
  });

  it("re-issues a turn whose streamed tool input wasn't valid JSON", async () => {
    const { result, calls, events } = await run(["json-error", message([text("Hi")], "end_turn")]);
    expect(calls).toHaveLength(2);
    expect(events).toContainEqual({ type: "progress", text: "Retrying a step…" });
    expect(result.history).toHaveLength(2);
  });

  it("reports API errors, keeping history at the last consistent point", async () => {
    const rateLimited = new Anthropic.RateLimitError(
      429,
      { type: "error" },
      "rate limited",
      new Headers(),
    );
    const { result, events } = await run([
      message([toolUse("t1", "getWalletBalances", {})], "tool_use"),
      rateLimited,
    ]);
    expect(events.at(-1)).toEqual({
      type: "error",
      message: "The assistant is busy right now. Try again in a minute.",
    });
    // user, assistant tool_use, user tool_result: complete and resumable.
    expect(result.history).toHaveLength(3);
  });

  it("says so when the Anthropic account has no credits", async () => {
    // Shaped like the API's real response.
    const noCredits = new Anthropic.BadRequestError(
      400,
      {
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "Your credit balance is too low to access the Anthropic API.",
        },
      },
      undefined,
      new Headers(),
    );
    const { events } = await run([noCredits]);
    expect(events.at(-1)).toEqual({
      type: "error",
      message: "The assistant is unavailable: its Anthropic account is out of credits.",
    });
  });

  it("stops a truncated tool call (max_tokens) instead of running it", async () => {
    const { tool, events, result } = await run([
      message([toolUse("t1", "submit_plan", { items: [{}] })], "max_tokens"),
    ]);
    expect(tool).not.toHaveBeenCalled();
    expect(events.at(-1)?.type).toBe("error");
    expect(result.history).toHaveLength(1);
  });
});

describe("echoableContent", () => {
  it("keeps everything when there was no fallback", () => {
    const content = [thinking("x"), text("y"), toolUse("a", "listStocks", {})];
    expect(echoableContent(content)).toBe(content);
  });
});
