import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { HOLE, LOGO_COLORS, NIB_PATH, SLIT } from "@/components/brand/logo";
import { TAGLINE } from "@/lib/brand";

export const alt = `Quill: ${TAGLINE} An AI that researches tokenized US stocks on Solana; you approve every buy.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview: the wordmark on cream, the tagline, and the three facts that matter. */
export default async function OpengraphImage() {
  // Fraunces SemiBold (SIL Open Font License), the display serif, bundled for ImageResponse.
  const fraunces = await readFile(join(process.cwd(), "src/app/_fonts/Fraunces-SemiBold.woff"));
  const c = LOGO_COLORS.light;
  const [first, second] = TAGLINE.split(". ");
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#F6EFE4",
        color: "#2A1A1E",
        fontFamily: "Fraunces",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg width="84" height="84" viewBox="0 0 32 32">
          <path d={NIB_PATH} fill={c.nib} />
          <line
            x1={SLIT.x1}
            y1={SLIT.y1}
            x2={SLIT.x2}
            y2={SLIT.y2}
            stroke={c.slit}
            strokeWidth={SLIT.width}
            strokeLinecap="round"
          />
          <circle cx={HOLE.cx} cy={HOLE.cy} r={HOLE.r} fill={c.hole} />
        </svg>
        <div style={{ fontSize: 64, letterSpacing: -1.5 }}>quill</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>{`${first}.`}</div>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2, color: "#6B1E2E" }}>
          {second}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 24,
          fontSize: 26,
          color: "#736350",
          borderTop: "2px solid #E2D6C3",
          paddingTop: 28,
        }}
      >
        <span>Tokenized US stocks on Solana</span>
        <span style={{ color: "#D9A441" }}>•</span>
        <span>Live Jupiter quotes</span>
        <span style={{ color: "#D9A441" }}>•</span>
        <span>You approve every buy</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: "Fraunces", data: fraunces, weight: 600, style: "normal" }],
    },
  );
}
