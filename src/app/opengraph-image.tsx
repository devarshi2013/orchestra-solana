import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { qMarkSvg } from "@/components/brand/quill-mark";

export const alt =
  "Quill: Think before you trade. Quill does the research. Search, research and buy tokenized US stocks; every trade is approved in your own wallet.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview, in the site's dark theme: the Q mark and name, the headline, and three facts. */
export default async function OpengraphImage() {
  // Sora SemiBold (SIL Open Font License), the heading font, bundled for ImageResponse.
  const sora = await readFile(join(process.cwd(), "src/app/_fonts/Sora-SemiBold.ttf"));
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${qMarkSvg({ fg: "#F5F7FA", cut: "#07090D" })}</svg>`;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "radial-gradient(circle at 85% 0%, #1E3A8A 0%, #07090D 55%)",
        color: "#F5F7FA",
        fontFamily: "Sora",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <img
          width={72}
          height={72}
          alt=""
          src={`data:image/svg+xml;utf8,${encodeURIComponent(mark)}`}
        />
        <div style={{ fontSize: 56, letterSpacing: -1.5 }}>Quill</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2 }}>
          Think before you trade.
        </div>
        <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -2, color: "#8FA4FF" }}>
          Quill does the research.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          gap: 24,
          fontSize: 26,
          color: "#A3ACB9",
          borderTop: "2px solid rgba(255,255,255,0.08)",
          paddingTop: 28,
        }}
      >
        <span>Tokenized US stocks on Solana</span>
        <span>•</span>
        <span>Live Jupiter data</span>
        <span>•</span>
        <span>You approve every trade</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: "Sora", data: sora, weight: 600, style: "normal" }],
    },
  );
}
