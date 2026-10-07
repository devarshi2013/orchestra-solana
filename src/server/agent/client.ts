import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { serverEnv } from "@/env/server";

let client: Anthropic | null = null;

/** The Claude API client. The key is server-only (ANTHROPIC_API_KEY) and never logged. */
export function anthropic(): Anthropic | null {
  if (!serverEnv.ANTHROPIC_API_KEY) return null;
  return (client ??= new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY }));
}
