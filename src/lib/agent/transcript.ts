import type Anthropic from "@anthropic-ai/sdk";

import type { SymphonyProposal, ToolCallView, TranscriptTurn } from "@/lib/assistant/views";

import { acceptedPlanSchema, type AcceptedPlan } from "./plan";
import { redactAddresses, redactAddressesInData } from "./redact";

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam;

/** Starts the context block an "Ask AI" panel adds before the user's message; never displayed. */
export const CONTEXT_TAG = "<orchestra-context>";

/** Longest tool result shown in a "data used" panel. */
export const MAX_DISPLAYED_RESULT = 20_000;

/** A tool result as the browser may show it: addresses redacted, very long results cut. */
export function displayToolResult(content: string): string {
  const safe = redactAddressesInData(content);
  return safe.length > MAX_DISPLAYED_RESULT
    ? `${safe.slice(0, MAX_DISPLAYED_RESULT)}\n… (cut: ${safe.length - MAX_DISPLAYED_RESULT} more characters)`
    : safe;
}

/** The accepted plan carried by a submit_plan result, if any. */
function planFromResult(content: string): AcceptedPlan | null {
  try {
    const parsed = JSON.parse(content) as { accepted?: boolean; plan?: unknown };
    if (!parsed.accepted) return null;
    const plan = acceptedPlanSchema.safeParse(parsed.plan);
    return plan.success ? plan.data : null;
  } catch {
    return null;
  }
}

/** The proposal carried by an accepted createSymphony result, if any. */
function proposalFromResult(content: string): SymphonyProposal | null {
  try {
    const parsed = JSON.parse(content) as Partial<SymphonyProposal> & { accepted?: boolean };
    if (!parsed.accepted || !parsed.tree) return null;
    return {
      tree: parsed.tree,
      backtest: parsed.backtest ?? null,
      backtestNote: parsed.backtestNote ?? null,
    };
  } catch {
    return null;
  }
}

const resultText = (content: Anthropic.Beta.Messages.BetaToolResultBlockParam["content"]) =>
  typeof content === "string"
    ? content
    : (content ?? []).map((block) => (block.type === "text" ? block.text : "")).join("");

/**
 * Replays a stored conversation (the exact API history) as display turns: each
 * user question, then one assistant turn with its text, the tool calls and
 * results it used, and the plan it submitted. Thinking blocks aren't shown.
 */
export function transcriptOf(messages: MessageParam[]): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  let current: Extract<TranscriptTurn, { role: "assistant" }> | null = null;
  const calls = new Map<string, ToolCallView>();

  for (const message of messages) {
    if (message.role === "user") {
      if (typeof message.content === "string") {
        current = null;
        turns.push({ role: "user", text: message.content });
        continue;
      }
      for (const block of message.content) {
        if (block.type === "text") {
          if (block.text.startsWith(CONTEXT_TAG)) continue;
          current = null;
          turns.push({ role: "user", text: block.text });
        } else if (block.type === "tool_result") {
          const call = calls.get(block.tool_use_id);
          if (!call) continue;
          const content = resultText(block.content);
          call.result = displayToolResult(content);
          call.ok = !block.is_error;
          if (call.name === "submit_plan" && current) current.plan = planFromResult(content);
          if (call.name === "createSymphony" && current) {
            const proposal = proposalFromResult(content);
            if (proposal) current.symphonies.push({ id: call.id, ...proposal });
          }
        }
      }
      continue;
    }
    if (!current) {
      current = { role: "assistant", text: "", tools: [], plan: null, symphonies: [] };
      turns.push(current);
    }
    const blocks = typeof message.content === "string" ? [] : message.content;
    if (typeof message.content === "string") current.text += redactAddresses(message.content);
    for (const block of blocks) {
      if (block.type === "text") {
        current.text += redactAddresses(block.text);
      } else if (block.type === "tool_use") {
        const call: ToolCallView = {
          id: block.id,
          name: block.name,
          input: block.input,
          result: null,
          ok: null,
        };
        calls.set(block.id, call);
        current.tools.push(call);
      }
    }
  }
  return turns;
}

/** A short title for the history list: the first question. */
export function conversationTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 79)}…` : oneLine;
}
