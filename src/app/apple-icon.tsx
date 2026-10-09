import { ImageResponse } from "next/og";

import { HOLE, LOGO_COLORS, NIB_PATH, SLIT } from "@/components/brand/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon: the burgundy nib on cream, with room for iOS's rounded corners. */
export default function AppleIcon() {
  const c = LOGO_COLORS.light;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F6EFE4",
      }}
    >
      <svg width="128" height="128" viewBox="0 0 32 32">
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
    </div>,
    size,
  );
}
