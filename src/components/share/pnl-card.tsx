/* eslint-disable @next/next/no-img-element -- ImageResponse renders plain <img> (Satori). */
import { ImageResponse } from "next/og";

import { MARK_INK, markSvg } from "@/components/brand/tickertape-mark";

/**
 * The shareable P&L card (1200×630 PNG), drawn from figures the caller has
 * already computed from real data; `data: null` draws "No trades yet".
 */

export type PnlCardData = {
  value: number;
  /** Unrealized P&L over the period; null when it can't be known (not enough history). */
  change: { pnl: number; pct: number } | null;
  top: { mint: string; symbol: string; pnl: number; pnlPct: number; logo: string | null }[];
};

export type PnlCardPeriod = "all" | "30d";

const SIZE = { width: 1200, height: 630 };
const INK = "#16161A";
const MUTED = "#86858F";
const SOFT = "#F4F4F9";
const GAIN = "#15803D";
const LOSS = "#DC2626";

const usd = (n: number) =>
  `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signedUsd = (n: number) => `${n < 0 ? "−" : "+"}${usd(n)}`;
const signedPct = (n: number) => `${n < 0 ? "−" : "+"}${Math.abs(n).toFixed(2)}%`;
const tone = (n: number) => (n < 0 ? LOSS : GAIN);
const short = (wallet: string) => `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
const dataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export function pnlCardImage({
  wallet,
  period,
  data,
}: {
  wallet: string;
  period: PnlCardPeriod;
  data: PnlCardData | null;
}) {
  const date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const label = period === "30d" ? "P&L · 30 days" : "P&L · all time";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "linear-gradient(180deg, #F6F6FA 0%, #FFFFFF 55%)",
        color: INK,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            width={56}
            height={56}
            alt=""
            style={{ borderRadius: 14 }}
            src={dataUrl(markSvg({ fg: "#FFFFFF", bg: MARK_INK }))}
          />
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: -0.5 }}>Tickertape</div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: MUTED }}>
          <span>{short(wallet)}</span>
          <span>·</span>
          <span>{date}</span>
        </div>
      </div>

      {data ? (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 26, color: MUTED }}>{label}</div>
            {data.change ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
                <div
                  style={{
                    fontSize: 112,
                    fontWeight: 600,
                    letterSpacing: -4,
                    color: tone(data.change.pnl),
                  }}
                >
                  {signedPct(data.change.pct)}
                </div>
                <div style={{ fontSize: 40, fontWeight: 500, color: tone(data.change.pnl) }}>
                  {signedUsd(data.change.pnl)}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 64, fontWeight: 600, color: MUTED }}>
                Not enough history yet
              </div>
            )}
            <div style={{ display: "flex", gap: 12, fontSize: 28, color: MUTED }}>
              <span>Value</span>
              <span style={{ color: INK, fontWeight: 500 }}>{usd(data.value)}</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 380 }}>
            {data.top.map((row) => (
              <div
                key={row.mint}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 20px",
                  borderRadius: 20,
                  background: SOFT,
                }}
              >
                {row.logo ? (
                  <img width={40} height={40} alt="" src={row.logo} style={{ borderRadius: 999 }} />
                ) : (
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 999,
                      background: INK,
                      color: "#FFFFFF",
                      fontSize: 16,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {row.symbol.slice(0, 2)}
                  </div>
                )}
                <div style={{ fontSize: 28, fontWeight: 600, flexGrow: 1 }}>{row.symbol}</div>
                <div style={{ fontSize: 28, fontWeight: 600, color: tone(row.pnl) }}>
                  {signedPct(row.pnlPct)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 26, color: MUTED }}>{label}</div>
          <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: -3 }}>No trades yet</div>
        </div>
      )}

      <div style={{ display: "flex", fontSize: 22, color: MUTED }}>Tokenized stocks on Solana</div>
    </div>,
    { ...SIZE, headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=0" } },
  );
}
