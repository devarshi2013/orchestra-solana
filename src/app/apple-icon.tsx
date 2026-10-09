import { ImageResponse } from "next/og";

import { BUBBLE_PATH, CHECK_PATH } from "@/components/brand/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon: the mark on ink, with room for iOS's rounded corners. */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111214",
      }}
    >
      <svg width="124" height="124" viewBox="0 0 32 32">
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
    </div>,
    size,
  );
}
