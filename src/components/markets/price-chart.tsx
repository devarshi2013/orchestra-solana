"use client";

import {
  AreaSeries,
  ColorType,
  createChart,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/hooks/use-markets";
import { friendlyError } from "@/lib/friendly-error";
import type { WindowId } from "@/lib/market/config";
import { formatPrice, type Candle } from "@/lib/market/series";
import { cn } from "@/lib/utils";

const TIMEFRAMES: { id: WindowId; label: string }[] = [
  { id: "1h", label: "1H" },
  { id: "24h", label: "1D" },
  { id: "7d", label: "1W" },
  { id: "30d", label: "1M" },
  { id: "1y", label: "1Y" },
];

// The theme's colours as hex: the chart draws on a canvas and can't read CSS variables.
const GAIN = "#22C55E";
const LOSS = "#EF4444";
const MUTED = "#A3ACB9";
const GRID = "rgba(255,255,255,0.05)";

type Tip = { left: number; top: number; time: string; price: string } | null;

/**
 * A stock's price chart (lightweight-charts, TradingView's open-source charts):
 * an area line coloured by the period's move, 1H to 1Y timeframes, a
 * crosshair and a hover tooltip. History comes from /api/markets/history.
 * With `fixedWindow` it is just the plot for that one timeframe, filling its
 * parent (no card, no timeframe tabs): the home page's hero uses it that way.
 */
export function PriceChart({ ticker, fixedWindow }: { ticker: string; fixedWindow?: WindowId }) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Area"> | null>(null);
  const [picked, setWindowId] = useState<WindowId>("24h");
  const windowId = fixedWindow ?? picked;
  // The last load's outcome, tagged with what it was for: anything else is still loading.
  const [loaded, setLoaded] = useState<{ key: string; error: string | null } | null>(null);
  const key = `${ticker}:${windowId}`;
  const status = loaded?.key !== key ? "loading" : loaded.error ? "error" : "ready";
  const [tip, setTip] = useState<Tip>(null);

  // Create the chart once.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const c = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: MUTED,
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: GRID }, horzLines: { color: GRID } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      handleScale: false,
      handleScroll: false,
    });
    const s = c.addSeries(AreaSeries, {
      lineWidth: 2,
      priceLineVisible: false,
      // The hero shows the live price beside the chart, so no second (candle) price label there.
      lastValueVisible: !fixedWindow,
      priceFormat: { type: "custom", formatter: (p: number) => formatPrice(p), minMove: 0.0001 },
    });
    c.subscribeCrosshairMove((param) => {
      const point = param.seriesData.get(s) as { value?: number } | undefined;
      if (!param.point || !param.time || point?.value === undefined) return setTip(null);
      setTip({
        // Keep the tooltip inside the chart.
        left: Math.min(Math.max(param.point.x + 12, 0), el.clientWidth - 150),
        top: Math.max(param.point.y - 52, 0),
        time: new Date((param.time as number) * 1000).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        price: formatPrice(point.value),
      });
    });
    chart.current = c;
    series.current = s;
    return () => {
      c.remove();
      chart.current = null;
      series.current = null;
    };
  }, [fixedWindow]);

  // Load the timeframe's history and draw it.
  useEffect(() => {
    const abort = new AbortController();
    getJson<{ candles: Candle[] }>(
      `/api/markets/history?ticker=${encodeURIComponent(ticker)}&window=${windowId}`,
      abort.signal,
    )
      .then(({ candles }) => {
        const s = series.current;
        if (!s) return;
        const seen = new Set<number>();
        const data = candles
          .filter((c) => !seen.has(c.time) && seen.add(c.time))
          .sort((a, b) => a.time - b.time)
          .map((c) => ({ time: c.time as UTCTimestamp, value: c.close }));
        const up = data.length < 2 || data.at(-1)!.value >= data[0]!.value;
        const color = up ? GAIN : LOSS;
        s.applyOptions({
          lineColor: color,
          topColor: up ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)",
          bottomColor: "rgba(7,9,13,0)",
        });
        s.setData(data);
        chart.current?.timeScale().fitContent();
        setLoaded({ key, error: null });
      })
      .catch((e: unknown) => {
        if (abort.signal.aborted) return;
        console.error("[chart] history failed", e);
        series.current?.setData([]);
        setLoaded({ key, error: friendlyError(e) });
      });
    return () => abort.abort();
  }, [ticker, windowId, key]);

  const plot = (
    <>
      <div ref={container} className="absolute inset-0" aria-label={`${ticker} price chart`} />
      {status === "loading" && <Skeleton className="absolute inset-0 rounded-xl opacity-60" />}
      {status === "error" && (
        <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
          {loaded?.error}
        </p>
      )}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-lift"
          style={{ left: tip.left, top: tip.top }}
        >
          <p className="font-mono font-medium text-foreground tabular-nums">{tip.price}</p>
          <p className="text-muted-foreground">{tip.time}</p>
        </div>
      )}
    </>
  );
  if (fixedWindow) return <div className="relative size-full">{plot}</div>;

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5">
      <div role="tablist" aria-label="Timeframe" className="mb-3 flex gap-1">
        {TIMEFRAMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={windowId === t.id}
            onClick={() => setWindowId(t.id)}
            className={cn(
              "rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              windowId === t.id
                ? "bg-surface-raised text-foreground"
                : "text-muted-foreground hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="relative h-72 sm:h-96" data-lenis-prevent>
        {plot}
      </div>
    </div>
  );
}
