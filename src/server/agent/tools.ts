import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { validatePlan, type AcceptedPlan } from "@/lib/agent/plan";
import { STOCKS } from "@/lib/stocks/registry";
import {
  getStockMetrics,
  getSwapQuote,
  getWalletBalances,
  listStocksTool,
} from "@/lib/stocks/tools";
import { SECTORS } from "@/lib/stocks/types";

/**
 * The assistant's tools: the stock tools (src/lib/stocks/tools.ts) plus
 * submit_plan. The wallet is never a model input: balances and quotes always
 * use the connected wallet, injected here.
 */

type Tool = Anthropic.Beta.Messages.BetaTool;

/** Stable order and content: tools are part of the cached prompt prefix. */
export const AGENT_TOOLS: Tool[] = [
  {
    name: "listStocks",
    description:
      "List the tokenized stocks and ETFs buyable through Jupiter on Solana (the only assets you may suggest). Each company has its ticker, name, type, sector, industry, liquidity tier (high/medium/low, from a test quote's price impact) and the issuers' token symbols. Filter by sector, industry, type, search text and minimum liquidity; most liquid first, up to 60 per call. `searched` echoes what was searched.",
    input_schema: {
      type: "object",
      properties: {
        sector: {
          type: "string",
          description: `One of: ${SECTORS.join(", ")}. Aliases like "tech", "banks", "healthcare", "oil" work.`,
        },
        industry: {
          type: "string",
          description: 'Part of an industry name, e.g. "semiconductor", "bank", "oil".',
        },
        type: { type: "string", enum: ["stock", "etf"] },
        search: { type: "string", description: "Part of a ticker, token symbol or company name." },
        minLiquidity: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: '"high" = high only, "medium" = high and medium, "low" = all.',
        },
      },
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
          description: "Tickers from listStocks, e.g. NVDA, AAPL (max 20).",
        },
      },
      required: ["tickers"],
      additionalProperties: false,
    },
  },
  {
    name: "getSwapQuote",
    description:
      "A live Jupiter quote for spending `usdcAmount` USDC from the user's wallet on one stock. A ticker quotes the issuers' tokens one at a time, most liquid first, and returns the first Jupiter can build (issuersCompared lists those tried); a token symbol (e.g. NVDAx) quotes only that issuer. Returns tokens out, price impact %, fees, liquidity tier, and a warning if the wallet can't make the trade. Only quotes; never trades.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: "Ticker (best issuer) or token symbol (that issuer) from listStocks.",
        },
        usdcAmount: { type: "number", description: "USDC to spend, in whole USDC." },
      },
      required: ["ticker", "usdcAmount"],
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
      "Submit the final recommended plan. The server checks that every ticker is a listed stock, each item is at least the minimum order size, and the total fits the wallet's USDC; errors come back for you to fix. Never executes anything: the user reviews live quotes and approves each buy in their wallet.",
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
              ticker: { type: "string" },
              usdcAmount: { type: "number" },
              reason: { type: "string", description: "Why, citing the metrics used." },
            },
            required: ["kind", "ticker", "usdcAmount", "reason"],
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
    case "listStocks":
      return ok(await listStocksTool(input ?? {}));
    case "getStockMetrics": {
      const args = tickersInput.safeParse(input);
      if (!args.success) return invalid(args.error);
      return ok(await getStockMetrics(args.data.tickers));
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
      const balances = await getWalletBalances(wallet);
      const result = validatePlan(input, {
        stocks: STOCKS,
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
