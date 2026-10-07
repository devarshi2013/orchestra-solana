import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { validatePlan, type AcceptedPlan } from "@/lib/agent/plan";
import {
  createSymphony,
  explainRebalance,
  getCryptoMetrics,
  getStockMetrics,
  getSwapQuote,
  getSymphony,
  getWalletBalances,
  listAssets,
  listMySymphonies,
  runBacktest,
} from "@/lib/assets/tools";
import type { SymphonyProposal } from "@/lib/assistant/views";
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

/** How the model writes a symphony: tickers only, never mints (src/lib/symphony/ticker-tree.ts). */
const SYMPHONY_TREE_DOC = `A symphony: { name, description?, root }. root is one node:
- { type: "asset", ticker } (a ticker or token symbol from listAssets; USDC is cash)
- { type: "group", name, weight, children: [nodes] } with weight { method: "equal" } | { method: "specified", percentages: [one per child, summing to 100] } | { method: "inverseVolatility", lookbackDays }
- { type: "if", condition: { left: { ticker, indicator }, comparator: "gt" | "gte" | "lt" | "lte", right: number | { ticker, indicator } }, then: node, else: node }
- { type: "filter", sortBy: indicator, select: { direction: "top" | "bottom", count }, children: [nodes] } (keeps the top/bottom count children, equally weighted)
indicator: { fn: "price" } or { fn: "sma" | "ema" | "rsi" | "cumulativeReturn" | "maxDrawdown" | "stdevReturn", period: days }.`;

const symphonyId = {
  type: "object",
  properties: {
    symphonyId: { type: "string", description: "An id from listMySymphonies or the context." },
  },
  required: ["symphonyId"],
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
  {
    name: "createSymphony",
    description:
      "Propose a symphony (an automated strategy tree). The server checks it against the symphony rules and the asset registry, backtests it, and shows it to the user as a card they can open in the editor (or, in the editor's Ask AI panel, as a diff they accept or reject). Errors come back for you to fix. Never saves or invests anything.",
    input_schema: {
      type: "object",
      properties: {
        symphony: { type: "object", description: SYMPHONY_TREE_DOC },
        period: {
          type: "string",
          enum: ["3M", "6M", "1Y", "max"],
          description: "Backtest period (default 1Y).",
        },
      },
      required: ["symphony"],
      additionalProperties: false,
    },
  },
  {
    name: "listMySymphonies",
    description: "The user's symphonies: live investments and saved drafts, with ids.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "getSymphony",
    description: "One of the user's symphonies as a ticker tree, with its schedule if it's live.",
    strict: true,
    input_schema: symphonyId,
  },
  {
    name: "runBacktest",
    description:
      "Run Orchestra's backtester on one of the user's symphonies (symphonyId) or on a symphony tree (symphony), over a period. Returns total return, CAGR, max drawdown, volatility, Sharpe, SOL buy-and-hold for comparison, costs, and tokens with too little history. Give exactly one of symphonyId or symphony.",
    input_schema: {
      type: "object",
      properties: {
        symphonyId: { type: "string" },
        symphony: { type: "object", description: SYMPHONY_TREE_DOC },
        period: { type: "string", enum: ["3M", "6M", "1Y", "max"] },
      },
      required: ["period"],
      additionalProperties: false,
    },
  },
  {
    name: "explainRebalance",
    description:
      "Why a symphony's target allocation changed: each condition's values and result at the last rebalance (a week ago for drafts) versus the latest close, filter picks, the target before and now, and for a live investment how far the wallet drifted from target.",
    strict: true,
    input_schema: symphonyId,
  },
].map((tool) => ({ ...tool, eager_input_streaming: true }) as Tool);

export type ToolOutcome = {
  /** The tool_result content (JSON). */
  content: string;
  isError: boolean;
  /** Set when submit_plan was accepted. */
  plan?: AcceptedPlan;
  /** Set when createSymphony accepted a proposal. */
  symphony?: SymphonyProposal;
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
      symphony: outcome.symphony ? "proposed" : undefined,
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
    case "createSymphony": {
      const created = await createSymphony(input);
      if (!created.ok) {
        return { content: json({ accepted: false, errors: created.errors }), isError: true };
      }
      const proposal: SymphonyProposal = {
        tree: created.tree,
        backtest: created.backtest,
        backtestNote: created.backtestNote,
      };
      return {
        content: json({
          accepted: true,
          ...proposal,
          shownToUser:
            "The user sees this as a card. Nothing is saved or invested unless they open it in the editor and act there.",
        }),
        isError: false,
        symphony: proposal,
      };
    }
    case "listMySymphonies": {
      const args = noInput.safeParse(input ?? {});
      if (!args.success) return invalid(args.error);
      return ok(await listMySymphonies(wallet));
    }
    case "getSymphony":
      return ok(await getSymphony(input, wallet));
    case "runBacktest":
      return ok(await runBacktest(input, wallet));
    case "explainRebalance":
      return ok(await explainRebalance(input, wallet));
    default:
      return { content: json({ error: `Unknown tool "${name}"` }), isError: true };
  }
}
