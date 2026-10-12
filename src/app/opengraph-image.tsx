import { ImageResponse } from "next/og";

import { MARK_INK, markSvg } from "@/components/brand/tickertape-mark";

export const alt =
  "Tickertape: research and buy tokenized US stocks on Solana; every trade is approved in your own wallet.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#232325";
const MUTED = "#6E6C75";

/** The link preview, in the site's light look: the app icon and name, the headline, three facts. */
export default function OpengraphImage() {
  const icon = markSvg({ fg: "#FFFFFF", bg: MARK_INK });
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "linear-gradient(180deg, #F3F2F5 0%, #FFFFFF 60%)",
        color: INK,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img
          width={72}
          height={72}
          alt=""
          style={{ borderRadius: 16 }}
          src={`data:image/svg+xml;utf8,${encodeURIComponent(icon)}`}
        />
        <div style={{ fontSize: 52, fontWeight: 600, letterSpacing: -1 }}>Tickertape</div>
      </div>
      <div style={{ fontSize: 76, lineHeight: 1.04, letterSpacing: -2, fontWeight: 500 }}>
        Tokenized US stocks on Solana
      </div>
      <div
        style={{
          display: "flex",
          gap: 24,
          fontSize: 26,
          color: MUTED,
          borderTop: "2px solid rgba(35,35,37,0.1)",
          paddingTop: 28,
        }}
      >
        <span>Every issuer, live from Jupiter</span>
        <span>•</span>
        <span>Research with AI</span>
        <span>•</span>
        <span>You approve every trade</span>
      </div>
    </div>,
    size,
  );
}
