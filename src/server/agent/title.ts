import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { cleanAiTitle } from "@/lib/assistant/chat-history";
import { redactAddresses } from "@/lib/agent/redact";

/** A small, fast model is plenty for a 3-6 word title. */
export const TITLE_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `You name chats in a research app for tokenized US stocks. Given the user's first message and the start of the reply, write a title of 3 to 6 words that says what the chat is about (e.g. "Top tech stocks for 200 USDC", "Comparing NVDA and AMD"). Plain text only: no quotes, no punctuation at the end, no emoji. Reply with the title and nothing else.`;

type TitleClient = {
  messages: {
    create(
      params: Anthropic.MessageCreateParamsNonStreaming,
      options?: { signal?: AbortSignal },
    ): Promise<Anthropic.Message>;
  };
};

/** A short title for a chat, or null if the model's answer isn't a usable title. */
export async function generateTitle(
  client: TitleClient,
  message: string,
  reply: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const response = await client.messages.create(
    {
      model: TITLE_MODEL,
      max_tokens: 32,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `First message:\n${message}\n\nStart of the reply:\n${reply}`,
        },
      ],
    },
    { signal },
  );
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const title = cleanAiTitle(redactAddresses(text));
  return title && !title.includes("[address removed]") ? title : null;
}
