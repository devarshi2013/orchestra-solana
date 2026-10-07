import { evaluateWithWarnings } from "@/lib/symphony/evaluate";
import { barIndexAt, type MarketData } from "@/lib/symphony/market-data";
import type { Allocation, Symphony } from "@/lib/symphony/types";
import { SOL_MINT, USDC_MINT } from "@/lib/tokens";

import { computeMetrics } from "./metrics";
import { isScheduledRebalance, maxDrift } from "./schedule";
import type { BacktestConfig, BacktestResult, EquityPoint, RebalanceRecord, Trade } from "./types";

/** USDC is the portfolio's cash: valued at $1, never traded. */
export const CASH_MINT = USDC_MINT;

export class BacktestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BacktestError";
  }
}

type Portfolio = { cash: number; units: Record<string, number> };
type Prices = (mint: string) => number | null;

/**
 * Simulates `symphony` over [startDate, endDate] on daily closes. Pure and
 * deterministic.
 *
 * No look-ahead: on each trading day t the symphony is evaluated on data up to
 * day t−1's close, and trades fill at that close (≈ day t's open; crypto
 * trades around the clock). Equity is then marked at day t's close. The
 * equity curve starts at the capital on the day before `startDate`.
 *
 * Costs per fill: slippage moves the price against the trade (buy at
 * p·(1+s), sell at p·(1−s)); the fee is then taken from the traded USDC.
 * Sells run first; if their costs leave too little cash for every buy, buys
 * are scaled down pro rata.
 */
export function runBacktest(
  symphony: Symphony,
  data: MarketData,
  config: BacktestConfig,
): BacktestResult {
  const { dates } = data;
  const startIndex = dates.findIndex((date) => date >= config.startDate);
  const first = Math.max(1, startIndex);
  const last = barIndexAt(dates, config.endDate);
  if (startIndex === -1 || first > last) {
    const span = dates.length
      ? ` Stored prices cover ${dates[0]} to ${dates[dates.length - 1]}.`
      : "";
    throw new BacktestError(
      `No trading days between ${config.startDate} and ${config.endDate} with a prior close to trade on.${span}`,
    );
  }

  const fee = config.feeBps / 10_000;
  const slippage = config.slippageBps / 10_000;
  const prices =
    (index: number): Prices =>
    (mint) =>
      priceAt(data, mint, index);

  let portfolio: Portfolio = { cash: config.startingCapitalUsdc, units: {} };
  const rebalances: RebalanceRecord[] = [];
  const values = [config.startingCapitalUsdc];
  const benchmarkUnits = buyAndHold(
    config.startingCapitalUsdc,
    priceAt(data, SOL_MINT, first - 1),
    fee,
    slippage,
  );
  const equity: EquityPoint[] = [
    {
      date: dates[first - 1]!,
      value: config.startingCapitalUsdc,
      benchmark: benchmarkUnits === null ? null : config.startingCapitalUsdc,
    },
  ];

  for (let i = first; i <= last; i++) {
    const decidedOn = dates[i - 1]!;
    const fill = prices(i - 1);
    const scheduled = isScheduledRebalance(
      config.rebalance,
      dates[i]!,
      i === first ? null : decidedOn,
    );
    const needsTarget = scheduled || config.rebalance.kind === "threshold";

    if (needsTarget) {
      const { allocation, warnings } = evaluateWithWarnings(symphony.root, data, decidedOn);
      const { target, unpriced } = priceableTarget(allocation, fill);
      const drifted =
        config.rebalance.kind === "threshold" &&
        maxDrift(weightsOf(portfolio, fill), target) > config.rebalance.driftPct / 100;
      if (scheduled || drifted) {
        const executed = rebalance(portfolio, target, fill, fee, slippage);
        portfolio = executed.portfolio;
        rebalances.push({
          date: dates[i]!,
          decidedOn,
          target,
          weightsAfter: weightsOf(portfolio, fill),
          trades: executed.trades,
          cost: executed.trades.reduce((sum, t) => sum + t.cost, 0),
          warnings,
          unpriced,
        });
      }
    }

    const value = valueOf(portfolio, prices(i));
    values.push(value);
    const solClose = priceAt(data, SOL_MINT, i);
    equity.push({
      date: dates[i]!,
      value,
      benchmark: benchmarkUnits === null || solClose === null ? null : benchmarkUnits * solClose,
    });
  }

  const benchmarkValues = equity.map((point) => point.benchmark);
  return {
    equity,
    metrics: computeMetrics(values),
    benchmark: benchmarkValues.every((v): v is number => v !== null)
      ? computeMetrics(benchmarkValues)
      : null,
    rebalances,
    totalCost: rebalances.reduce((sum, r) => sum + r.cost, 0),
  };
}

/** Latest usable close of `mint` at or before `index`, or null if it has none yet. */
function priceAt(data: MarketData, mint: string, index: number): number | null {
  if (mint === CASH_MINT) return 1;
  const series = data.closes[mint] ?? [];
  for (let i = Math.min(index, series.length - 1); i >= 0; i--) {
    const close = series[i];
    if (typeof close === "number" && Number.isFinite(close) && close > 0) return close;
  }
  return null;
}

/** SOL units bought with `capital` at `price` after costs, or null without a price. */
function buyAndHold(
  capital: number,
  price: number | null,
  fee: number,
  slippage: number,
): number | null {
  return price === null ? null : (capital * (1 - fee)) / (price * (1 + slippage));
}

/** Moves weight of mints that can't be priced yet into cash. */
function priceableTarget(
  allocation: Allocation,
  fill: Prices,
): { target: Allocation; unpriced: string[] } {
  const target: Allocation = {};
  const unpriced: string[] = [];
  for (const [mint, weight] of Object.entries(allocation)) {
    const key = fill(mint) === null ? CASH_MINT : mint;
    if (key !== mint) unpriced.push(mint);
    target[key] = (target[key] ?? 0) + weight;
  }
  return { target, unpriced };
}

function valueOf(portfolio: Portfolio, price: Prices): number {
  let value = portfolio.cash;
  // Held mints were bought at a price, so one always exists from then on.
  for (const [mint, units] of Object.entries(portfolio.units)) value += units * price(mint)!;
  return value;
}

/** Current weights, cash under CASH_MINT. Sold-out mints are already removed from `units`. */
function weightsOf(portfolio: Portfolio, price: Prices): Allocation {
  const total = valueOf(portfolio, price);
  const weights: Allocation = {};
  if (portfolio.cash > 0) weights[CASH_MINT] = portfolio.cash / total;
  for (const [mint, units] of Object.entries(portfolio.units)) {
    weights[mint] = (units * price(mint)!) / total;
  }
  return weights;
}

/** Trades `portfolio` toward `target` weights at `price`, sells first. */
export function rebalance(
  portfolio: Portfolio,
  target: Allocation,
  price: Prices,
  fee: number,
  slippage: number,
): { portfolio: Portfolio; trades: Trade[] } {
  const total = valueOf(portfolio, price);
  const dust = total * 1e-9;
  const units = { ...portfolio.units };
  let cash = portfolio.cash;
  const trades: Trade[] = [];
  const mints = [...new Set([...Object.keys(units), ...Object.keys(target)])].filter(
    (m) => m !== CASH_MINT,
  );

  const gaps = mints.map((mint) => {
    const p = price(mint)!;
    return { mint, p, gap: (target[mint] ?? 0) * total - (units[mint] ?? 0) * p };
  });

  for (const { mint, p, gap } of gaps) {
    if (gap >= -dust) continue;
    const sold = Math.min(-gap / p, units[mint]!);
    const fillPrice = p * (1 - slippage);
    const usdc = sold * fillPrice * (1 - fee);
    units[mint] = units[mint]! - sold;
    if (units[mint]! <= 0) delete units[mint];
    cash += usdc;
    trades.push({ mint, side: "sell", units: sold, price: fillPrice, usdc, cost: sold * p - usdc });
  }

  const buys = gaps.filter(({ gap }) => gap > dust);
  const wanted = buys.reduce((sum, { gap }) => sum + gap, 0);
  const spendable = Math.max(0, cash - (target[CASH_MINT] ?? 0) * total);
  const scale = Math.min(1, spendable / wanted);
  for (const { mint, p, gap } of buys) {
    const usdc = gap * scale;
    const fillPrice = p * (1 + slippage);
    const bought = (usdc * (1 - fee)) / fillPrice;
    units[mint] = (units[mint] ?? 0) + bought;
    cash -= usdc;
    trades.push({
      mint,
      side: "buy",
      units: bought,
      price: fillPrice,
      usdc,
      cost: usdc - bought * p,
    });
  }

  return { portfolio: { cash: Math.max(cash, 0), units }, trades };
}
