import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { redactAddresses } from "@/lib/agent/redact";
import type { RebalanceExplanation } from "@/lib/symphony/explain";

import { AGENT_MODEL } from "./loop";

/** The slice of the SDK client the explainer uses (tests supply a fake). */
export type ExplainClient = {
  messages: {
    create(
      params: Anthropic.Messages.MessageCreateParamsNonStreaming,
    ): Promise<Pick<Anthropic.Messages.Message, "content" | "stop_reason">>;
  };
};

/** Byte-stable, so it caches across requests. */
export const EXPLAIN_SYSTEM = `You explain to an Orchestra user why their live symphony (an automated portfolio strategy) needs the trades on their rebalance screen. The user message is JSON from Orchestra's explainRebalance: the target allocation at the last rebalance ("targetBefore") and now ("targetNow"), each condition's values and result then and now, filter picks, and the wallet's drift from target ("drift": weight vs target, in fractions; driftPts in percentage points).

Write 2 to 4 short plain-language sentences:
- If a condition or filter changed, say which, with its values, and how it moved the target.
- Then name the largest drifts that make trades necessary.
- If nothing changed and drift is small, say the trades only restore the target.

Use only facts and numbers in the JSON; never add any others, and never predict prices or give advice. Fractions may be written as percentages (0.4 = 40%). Name tokens by the tickers given; never write an address.`;

/**
 * A short AI explanation of a rebalance, generated from explainRebalance's
 * data only (nothing else is in the request). The UI always shows the data
 * beneath it, so every figure can be checked.
 */
export async function explainWithAi(
  client: ExplainClient,
  explanation: RebalanceExplanation & { name: string },
): Promise<string> {
  const message = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: 2048,
    // Opus 5.5 always thinks adaptively; a short summary needs little of it.
    output_config: { effort: "low" },
    system: EXPLAIN_SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(explanation) }],
  });
  const text = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("")
    .trim();
  if (!text)
    throw new Error(`No explanation returned (${message.stop_reason ?? "no stop reason"})`);
  return redactAddresses(text);
}
