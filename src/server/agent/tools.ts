import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { validatePlan, type AcceptedPlan } from "@/lib/agent/plan";
import {
  getCryptoMetrics,
  getStockMetrics,
  getSwapQuote,
  getWalletBalances,
  listAssets,
} from "@/lib/assets/tools";
import { getRegistry } from "@/server/assets/registry";

/**
 * The assistant's tools: the asset tools (src/lib/assets/tools.ts) plus
 * submit_plan. The wallet is never a model input: balances and quotes always
 * use the signed-in wallet, injected here.
 */

type Tool = Anthropic.Beta.Messages.BetaTool;

const tickers = {
  type: "object",
  properties: {
    tickers: {
      type: "array",
      items: { type: "string" },
      description: "Tickers or token symbols from listAssets, e.g. NVDAx, SOL (max 20).",
    },
  },
  required: ["tickers"],
  additionalProperties: false,
} as const;

/** Stable order and content: tools are part of the cached prompt prefix. */
export const AGENT_TOOLS: Tool[] = [
  {
    name: "listAssets",
    description:
      "List the assets Orchestra can invest in (the only assets you may suggest). Optionally filter by kind ('stock' or 'crypto'), stock sector (e.g. 'Stock', 'ETF') or crypto category (e.g. 'Major', 'DeFi', 'Meme', 'Liquid staking').",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["stock", "crypto"] },
        sector: { type: "string" },
        category: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "getStockMetrics",
    description:
      "Fundamentals for the real companies behind tokenized stocks: market cap, P/E, annual revenue growth %, 1M/6M/1Y returns %. Null fields come with a reason in `missing`.",
    strict: true,
    input_schema: tickers,
  },
  {
    name: "getCryptoMetrics",
    description:
      "For crypto assets: price, market cap, 24h volume, liquidity, 7D/30D/1Y returns %, and 30-day annualized volatility %. Null fields come with a reason in `missing`.",
    strict: true,
    input_schema: tickers,
  },
  {
    name: "getSwapQuote",
    description:
      "A live Jupiter quote for spending `usdcAmount` USDC from the user's wallet on one asset: tokens out, price impact %, fees, and a warning if the wallet can't make the trade. Only quotes; never trades.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Ticker or token symbol from listAssets." },
        usdcAmount: { type: "number", description: "USDC to spend, in whole USDC." },
      },
      required: ["ticker", "usdcAmount"],
      additionalProperties: false,
    },
  },
  {
    name: "getWalletBalances",
    description: "The signed-in user's USDC and SOL balances.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "submit_plan",
    description:
      "Submit the final recommended plan. The server checks that every ticker is in the registry, each item is at least the minimum order size, and the total fits the wallet's USDC; errors come back for you to fix. Never executes anything.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["stock", "crypto"] },
              ticker: { type: "string" },
              usdcAmount: { type: "number" },
              reason: { type: "string", description: "Why, citing the metrics used." },
            },
            required: ["kind", "ticker", "usdcAmount", "reason"],
            additionalProperties: false,
          },
        },
        totalUsdc: { type: "number" },
        rankingMethod: { type: "string", description: "How assets were ranked or selected." },
      },
      required: ["items", "totalUsdc", "rankingMethod"],
      additionalProperties: false,
    },
  },
].map((tool) => ({ ...tool, eager_input_streaming: true }) as Tool);

export type ToolOutcome = {
  /** The tool_result content (JSON). */
  content: string;
  isError: boolean;
  /** Set when submit_plan was accepted. */
  plan?: AcceptedPlan;
};

const tickersInput = z.object({ tickers: z.array(z.string()) }).strict();
const quoteInput = z.object({ ticker: z.string(), usdcAmount: z.number() }).strict();
const noInput = z.object({}).strict();

const short = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
const json = (value: unknown) => JSON.stringify(value);
const invalid = (error: z.ZodError): ToolOutcome => ({
  content: json({ error: `Invalid input: ${z.prettifyError(error)}` }),
  isError: true,
});

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
    outcome = await dispatch(name, input, wallet);
  } catch (error) {
    outcome = { content: json({ error: "The tool failed unexpectedly." }), isError: true };
    console.error(`[agent] tool ${name} threw`, error);
  }
  console.info(
    JSON.stringify({
      event: "agent.tool",
      wallet: short(wallet),
      tool: name,
      input,
      ok: !outcome.isError,
      plan: outcome.plan ? "accepted" : undefined,
      ms: Date.now() - started,
    }),
  );
  return outcome;
}

async function dispatch(name: string, input: unknown, wallet: string): Promise<ToolOutcome> {
  const ok = (value: unknown): ToolOutcome => ({ content: json(value), isError: false });
  switch (name) {
    case "listAssets":
      return ok(await listAssets(input));
    case "getStockMetrics":
    case "getCryptoMetrics": {
      const args = tickersInput.safeParse(input);
      if (!args.success) return invalid(args.error);
      return ok(
        await (name === "getStockMetrics" ? getStockMetrics : getCryptoMetrics)(args.data.tickers),
      );
    }
    case "getSwapQuote": {
      const args = quoteInput.safeParse(input);
      if (!args.success) return invalid(args.error);
      return ok(await getSwapQuote({ ...args.data, wallet }));
    }
    case "getWalletBalances": {
      const args = noInput.safeParse(input ?? {});
      if (!args.success) return invalid(args.error);
      return ok(await getWalletBalances(wallet));
    }
    case "submit_plan": {
      const [registry, balances] = await Promise.all([getRegistry(), getWalletBalances(wallet)]);
      const result = validatePlan(input, {
        assets: [...registry.stocks, ...registry.crypto],
        usdcBalance: balances.data?.usdc ?? null,
      });
      return result.ok
        ? {
            content: json({ accepted: true, plan: result.plan }),
            isError: false,
            plan: result.plan,
          }
        : { content: json({ accepted: false, errors: result.errors }), isError: true };
    }
    default:
      return { content: json({ error: `Unknown tool "${name}"` }), isError: true };
  }
}
