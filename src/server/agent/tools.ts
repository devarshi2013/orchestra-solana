import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { validatePlan, type AcceptedPlan } from "@/lib/agent/plan";
import { validateStrategy } from "@/lib/agent/strategy";
import type { StrategyProposal } from "@/lib/assistant/views";
import {
  getStockMetrics,
  getSwapQuote,
  getWalletBalances,
  searchStocksTool,
} from "@/lib/stocks/tools";
import { fmpConfigured } from "@/server/market/fmp";
import { stockUniverse } from "@/server/stocks/universe";

/**
 * The assistant's tools: the stock tools (src/lib/stocks/tools.ts) plus
 * submit_plan. The wallet is never a model input: balances and quotes always
 * use the connected wallet, injected here.
 */

type Tool = Anthropic.Beta.Messages.BetaTool;

/** Stable order and content: tools are part of the cached prompt prefix. */
const TOOLS: Tool[] = [
  {
    name: "searchStocks",
    description:
      "Search the tokenized stocks buyable through Jupiter on Solana (the only assets you may suggest) by company name, ticker or token symbol. Returns up to 25 companies, each with every issuer's token: symbol, issuer, USD price, 24h change %, liquidity, 24h volume and holders (null when Jupiter has no figure). An exact ticker or symbol match comes first.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: 'A company name, ticker or token symbol, e.g. "nvidia", "MU", "SPYx".',
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "getStockMetrics",
    description:
      "Fundamentals for the real companies behind tokenized stocks: market cap, P/E, annual revenue growth %, 1M/6M/1Y returns %. Null fields come with a reason in `missing`.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        tickers: {
          type: "array",
          items: { type: "string" },
          description: "Company tickers from searchStocks, e.g. NVDA, AAPL (max 20).",
        },
      },
      required: ["tickers"],
      additionalProperties: false,
    },
  },
  {
    name: "getSwapQuote",
    description:
      "Live Jupiter quotes for spending `usdcAmount` USDC from the user's wallet. A company ticker (e.g. NVDA) quotes every one of its tokens and returns them all; any other token symbol (e.g. NVDAx) quotes that token. Each quote has tokens out, price impact %, fees and a warning if the wallet can't make the trade, or a reason when there's no quote. Only quotes; never trades.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "A token symbol or company ticker from searchStocks.",
        },
        usdcAmount: { type: "number", description: "USDC to spend, in whole USDC." },
      },
      required: ["symbol", "usdcAmount"],
      additionalProperties: false,
    },
  },
  {
    name: "getWalletBalances",
    description: "The connected wallet's USDC and SOL balances.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "submit_plan",
    description:
      "Submit the final recommended plan. Each item names a token symbol (which issuer's token to buy). The server checks that every symbol is a listed stock token, each item is at least the minimum order size, and the total fits the wallet's USDC; errors come back for you to fix. Never executes anything: the user reviews live quotes and approves each buy in their wallet.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["stock"] },
              symbol: { type: "string", description: "A token symbol from searchStocks." },
              usdcAmount: { type: "number" },
              reason: { type: "string", description: "Why, citing the figures used." },
            },
            required: ["kind", "symbol", "usdcAmount", "reason"],
            additionalProperties: false,
          },
        },
        totalUsdc: { type: "number" },
        rankingMethod: { type: "string", description: "How stocks were ranked or selected." },
      },
      required: ["items", "totalUsdc", "rankingMethod"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_strategy",
    description:
      "Propose a conditional buy: spend `usdcAmount` USDC on a token when a condition is met. The server checks the symbol is a listed token, the amount meets the minimum order and the condition isn't met already; errors come back for you to fix. Creates nothing: the user confirms it, then they're notified when it triggers and approve the buy in their wallet.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "A token symbol from searchStocks, e.g. NVDAx." },
        usdcAmount: { type: "number", description: "USDC to spend when it triggers." },
        condition: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["price_below", "price_above", "change_below", "change_above", "every"],
            },
            value: {
              type: "number",
              description:
                "price_below/price_above: the token's USD price. change_below/change_above: 24h change in percent (e.g. -5 or 5). every: days between buys.",
            },
          },
          required: ["type", "value"],
          additionalProperties: false,
        },
        repeat: {
          type: "boolean",
          description: "Watch again after each buy (e.g. every dip). Always true for `every`.",
        },
      },
      required: ["symbol", "usdcAmount", "condition", "repeat"],
      additionalProperties: false,
    },
  },
].map((tool) => ({ ...tool, eager_input_streaming: true }) as Tool);

/**
 * The tools offered to the model: getStockMetrics only when a market-data key
 * is set. Fixed for a deployment, so the cached prefix stays byte-stable.
 */
export const agentTools = (): Tool[] =>
  fmpConfigured() ? TOOLS : TOOLS.filter((tool) => tool.name !== "getStockMetrics");

export type ToolOutcome = {
  /** The tool_result content (JSON). */
  content: string;
  isError: boolean;
  /** Set when submit_plan was accepted. */
  plan?: AcceptedPlan;
  /** Set when propose_strategy was accepted. */
  strategy?: StrategyProposal;
};

const json = (value: unknown) => JSON.stringify(value);
const ok = (value: unknown): ToolOutcome => ({ content: json(value), isError: false });

/** A wallet as logged: its first and last four characters. */
export const shortWallet = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;

/** A tool whose input must match `schema`; a mismatch goes back to the model as an error. */
const withInput =
  <S extends z.ZodType>(schema: S, run: (args: z.infer<S>, wallet: string) => Promise<unknown>) =>
  async (input: unknown, wallet: string): Promise<ToolOutcome> => {
    const args = schema.safeParse(input);
    if (!args.success) {
      return {
        content: json({ error: `Invalid input: ${z.prettifyError(args.error)}` }),
        isError: true,
      };
    }
    return ok(await run(args.data, wallet));
  };

const TOOL_RUNNERS = {
  searchStocks: async (input: unknown) => ok(await searchStocksTool(input)),
  getStockMetrics: withInput(z.object({ tickers: z.array(z.string()) }).strict(), async (args) =>
    fmpConfigured()
      ? getStockMetrics(args.tickers)
      : { data: null, reason: "Company fundamentals aren't available (no market-data key)." },
  ),
  getSwapQuote: withInput(
    z.object({ symbol: z.string(), usdcAmount: z.number() }).strict(),
    (args, wallet) => getSwapQuote({ ...args, wallet }),
  ),
  // No input: absent (or null) reads as {}.
  getWalletBalances: withInput(z.object({}).strict().nullish(), (_, wallet) =>
    getWalletBalances(wallet),
  ),
  submit_plan: async (input: unknown, wallet: string): Promise<ToolOutcome> => {
    const [balances, stocks] = await Promise.all([getWalletBalances(wallet), stockUniverse()]);
    const result = validatePlan(input, { stocks, usdcBalance: balances.data?.usdc ?? null });
    return result.ok
      ? { content: json({ accepted: true, plan: result.plan }), isError: false, plan: result.plan }
      : { content: json({ accepted: false, errors: result.errors }), isError: true };
  },
  propose_strategy: async (input: unknown): Promise<ToolOutcome> => {
    const result = validateStrategy(input, await stockUniverse());
    if (!result.ok)
      return { content: json({ proposed: false, errors: result.errors }), isError: true };
    // The model never sees a mint; the client gets it with the proposal.
    return {
      content: json({ proposed: true, strategy: { ...result.strategy, mint: undefined } }),
      isError: false,
      strategy: result.strategy,
    };
  },
};

/**
 * Runs one tool call for `wallet`. Each tool validates its own input; tool
 * "no data" results ({ data: null, reason }) are normal results for the model,
 * not errors. Logged without secrets: tool name, input, outcome, duration.
 */
export async function runAgentTool(
  name: string,
  input: unknown,
  wallet: string,
): Promise<ToolOutcome> {
  const started = Date.now();
  let outcome: ToolOutcome;
  try {
    outcome = Object.hasOwn(TOOL_RUNNERS, name)
      ? await TOOL_RUNNERS[name as keyof typeof TOOL_RUNNERS](input, wallet)
      : { content: json({ error: `Unknown tool "${name}"` }), isError: true };
  } catch (error) {
    outcome = { content: json({ error: "The tool failed unexpectedly." }), isError: true };
    console.error(`[agent] tool ${name} threw`, error);
  }
  console.info(
    JSON.stringify({
      event: "agent.tool",
      wallet: shortWallet(wallet),
      tool: name,
      input,
      ok: !outcome.isError,
      plan: outcome.plan ? "accepted" : undefined,
      strategy: outcome.strategy ? "proposed" : undefined,
      ms: Date.now() - started,
    }),
  );
  return outcome;
}
