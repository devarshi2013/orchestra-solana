import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { AcceptedPlan } from "@/lib/agent/plan";
import { SYSTEM_PROMPT } from "@/lib/agent/prompt";
import { createAddressRedactor } from "@/lib/agent/redact";
import { displayToolResult } from "@/lib/agent/transcript";

import { AGENT_TOOLS, type ToolOutcome } from "./tools";

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type ContentBlock = Anthropic.Beta.Messages.BetaContentBlock;
type Message = Anthropic.Beta.Messages.BetaMessage;
type StreamEvent = Anthropic.Beta.Messages.BetaRawMessageStreamEvent;
type ToolResult = Anthropic.Beta.Messages.BetaToolResultBlockParam;
type StreamParams = Omit<Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, "stream">;

/** The model and request shape for every assistant turn (docs/assistant.md). */
export const AGENT_MODEL = "claude-opus-5-5";
const MAX_MODEL_CALLS = 16;
const MAX_PLAN_ATTEMPTS = 3;
const MAX_JSON_RETRIES = 2;

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "progress"; text: string }
  | { type: "tool"; id: string; name: string; input: unknown }
  /** `content`: the result as the model saw it, for the "data used" panel (redacted, capped). */
  | { type: "tool_result"; id: string; name: string; ok: boolean; content: string }
  | { type: "plan"; plan: AcceptedPlan }
  | { type: "error"; message: string };

/** The slice of the SDK client the loop uses (so tests can supply a fake). */
export type AgentClient = {
  beta: {
    messages: {
      stream(
        params: StreamParams,
        options?: { signal?: AbortSignal },
      ): AsyncIterable<StreamEvent> & { finalMessage(): Promise<Message> };
    };
  };
};

export type AgentUsage = {
  modelCalls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

const requestParams = (messages: MessageParam[]): StreamParams => ({
  model: AGENT_MODEL,
  max_tokens: 64000,
  system: SYSTEM_PROMPT,
  tools: AGENT_TOOLS,
  // Opus 5.5 always thinks; "updates" returns its between-tool progress notes.
  thinking: { type: "adaptive", display: "updates" },
  output_config: { effort: "high" },
  // Safety classifiers can decline; re-run on Anthropic's recommended fallback model.
  betas: ["server-side-fallback-2026-07-01", "thinking-display-updates-2026-08-18"],
  fallbacks: "default",
  // System prompt and tools are byte-stable, so the prefix caches.
  cache_control: { type: "ephemeral" },
  messages,
});

/**
 * After a mid-output fallback, only text from before the switch may be echoed
 * back; the declined model's thinking and tool calls are dropped (and its tool
 * calls are not run).
 */
export function echoableContent(content: ContentBlock[]): ContentBlock[] {
  let lastFallback = -1;
  content.forEach((block, i) => {
    if (block.type === "fallback") lastFallback = i;
  });
  if (lastFallback < 0) return content;
  return content.filter((block, i) => i >= lastFallback || block.type === "text");
}

/** A user-facing message for an API failure (typed SDK errors; no internals). */
function describeError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError)
    return "The assistant is busy right now. Try again in a minute.";
  if (error instanceof Anthropic.AuthenticationError)
    return "The assistant isn't configured correctly (API key rejected).";
  if (error instanceof Anthropic.BadRequestError && /credit balance/i.test(error.message))
    return "The assistant is unavailable: its Anthropic account is out of credits.";
  if (error instanceof Anthropic.APIError) return "The assistant couldn't respond. Try again.";
  return "Something went wrong while answering. Try again.";
}

/**
 * Runs one user turn of the research assistant: a streamed tool-use loop until
 * Claude answers without calling tools. Never throws: failures are reported as
 * an `error` event, and the returned history is cut back to the last
 * consistent point (every tool_use answered) so it can be stored and resumed.
 */
export async function runAgentTurn(opts: {
  client: AgentClient;
  history: MessageParam[];
  userText: string;
  runTool: (name: string, input: unknown) => Promise<ToolOutcome>;
  emit: (event: AgentEvent) => void;
  signal?: AbortSignal;
}): Promise<{ history: MessageParam[]; plan: AcceptedPlan | null; usage: AgentUsage }> {
  const { client, runTool, emit, signal } = opts;
  const messages: MessageParam[] = [...opts.history, { role: "user", content: opts.userText }];
  let stable = messages.length;
  let plan: AcceptedPlan | null = null;
  let planAttempts = 0;
  let jsonRetries = 0;
  /** Whether any text has gone to the browser this turn. */
  let sentText = false;
  const usage: AgentUsage = { modelCalls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

  try {
    for (let call = 0; ; call++) {
      if (call >= MAX_MODEL_CALLS) {
        emit({ type: "error", message: "This took too many steps. Try a narrower question." });
        break;
      }
      const stream = client.beta.messages.stream(requestParams(messages), { signal });
      const redactor = createAddressRedactor();
      let message: Message;
      try {
        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block.type === "text") {
            // Each text block is its own paragraph: glued to the previous one, a table
            // after "Here they are:" wouldn't parse as a table.
            if (sentText) emit({ type: "text", delta: "\n\n" });
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              const safe = redactor.push(event.delta.text);
              if (safe) {
                emit({ type: "text", delta: safe });
                sentText = true;
              }
            } else if (event.delta.type === "thinking_delta" && event.delta.thinking.trim()) {
              emit({ type: "progress", text: event.delta.thinking });
            }
          } else if (event.type === "content_block_stop") {
            const rest = redactor.flush();
            if (rest) {
              emit({ type: "text", delta: rest });
              sentText = true;
            }
          }
        }
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (error) {
        // Only an unparseable streamed tool input is retried; API errors and aborts propagate.
        if (
          error instanceof Anthropic.APIError ||
          signal?.aborted ||
          jsonRetries++ >= MAX_JSON_RETRIES
        )
          throw error;
        emit({ type: "progress", text: "Retrying a step…" });
        continue;
      }

      usage.modelCalls++;
      usage.inputTokens += message.usage.input_tokens;
      usage.outputTokens += message.usage.output_tokens;
      usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;

      if (message.stop_reason === "refusal") {
        emit({ type: "error", message: "The assistant declined to answer this request." });
        break;
      }
      const content = echoableContent(message.content);
      if (message.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content });
        continue;
      }
      const toolUses = content.filter(
        (b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === "tool_use",
      );
      if (message.stop_reason === "max_tokens" && toolUses.length > 0) {
        emit({
          type: "error",
          message: "The answer ran too long to finish. Try a narrower question.",
        });
        break;
      }
      messages.push({ role: "assistant", content });
      if (toolUses.length === 0) {
        stable = messages.length;
        break;
      }

      // Run the turn's calls together; all results go back in one user message.
      const results = await Promise.all(
        toolUses.map(async (toolUse): Promise<ToolResult> => {
          emit({ type: "tool", id: toolUse.id, name: toolUse.name, input: toolUse.input });
          let outcome = await runTool(toolUse.name, toolUse.input);
          if (toolUse.name === "submit_plan") {
            planAttempts++;
            if (outcome.plan) {
              plan = outcome.plan;
              emit({ type: "plan", plan: outcome.plan });
            } else if (planAttempts >= MAX_PLAN_ATTEMPTS) {
              const errors = JSON.parse(outcome.content) as object;
              outcome = {
                ...outcome,
                content: JSON.stringify({
                  ...errors,
                  instruction: "Stop submitting. Explain to the user what prevents a valid plan.",
                }),
              };
            }
          }
          emit({
            type: "tool_result",
            id: toolUse.id,
            name: toolUse.name,
            ok: !outcome.isError,
            content: displayToolResult(outcome.content),
          });
          return {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: outcome.content,
            is_error: outcome.isError,
          };
        }),
      );
      messages.push({ role: "user", content: results });
      stable = messages.length;
    }
  } catch (error) {
    if (!signal?.aborted) {
      console.error("[agent] turn failed", error);
      emit({ type: "error", message: describeError(error) });
    }
  }
  return { history: messages.slice(0, stable), plan, usage };
}
