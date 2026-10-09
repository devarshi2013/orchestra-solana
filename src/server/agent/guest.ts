import "server-only";

import type { ToolOutcome } from "./tools";

export const NO_WALLET =
  "No wallet is connected. Ask the user to connect a Solana wallet to check balances, get swap quotes or make a plan.";

/** Tools that need the user's wallet: balances, quotes for it, and plans checked against it. */
const WALLET_TOOLS = new Set(["getWalletBalances", "getSwapQuote", "submit_plan"]);

/**
 * Runs a tool for a guest (no wallet connected): research tools run as usual,
 * and the wallet tools answer that a wallet is needed, so the assistant can
 * research but never quotes or plans without one.
 */
export async function runGuestTool(
  name: string,
  input: unknown,
  run: (name: string, input: unknown) => Promise<ToolOutcome>,
): Promise<ToolOutcome> {
  if (!WALLET_TOOLS.has(name)) return run(name, input);
  return name === "submit_plan"
    ? { content: JSON.stringify({ accepted: false, errors: [NO_WALLET] }), isError: true }
    : { content: JSON.stringify({ data: null, reason: NO_WALLET }), isError: false };
}
