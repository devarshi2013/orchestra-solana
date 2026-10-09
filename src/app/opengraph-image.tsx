import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { BUBBLE_PATH, CHECK_PATH } from "@/components/brand/logo";

export const alt =
  "Askfirst: an AI that researches tokenized US stocks on Solana, and buys only after you approve";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview: wordmark, the promise, and the three facts that matter. */
export default async function OpengraphImage() {
  // Space Grotesk Bold (SIL Open Font License), the heading font, bundled as TTF for ImageResponse.
  const spaceGrotesk = await readFile(join(process.cwd(), "src/app/_fonts/SpaceGrotesk-Bold.ttf"));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#111214",
        color: "#F2F2F3",
        fontFamily: "Space Grotesk",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width="72" height="72" viewBox="0 0 32 32">
          <path d={BUBBLE_PATH} fill="#FF5A1F" />
          <path
            d={CHECK_PATH}
            fill="none"
            stroke="#111214"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: -1.5 }}>Askfirst</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          Ask about US stocks on Solana.
        </div>
        <div
          style={{
            fontSize: 68,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            color: "#FF5A1F",
          }}
        >
          Approve every buy yourself.
        </div>
      </div>
      <div style={{ display: "flex", gap: 28, fontSize: 26, color: "#9C9CA3" }}>
        <span>Live Jupiter quotes</span>
        <span>·</span>
        <span>Non-custodial</span>
        <span>·</span>
        <span>Research, not financial advice</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: "Space Grotesk", data: spaceGrotesk, weight: 700, style: "normal" }],
    },
  );
}
