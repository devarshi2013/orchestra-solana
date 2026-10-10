import { ImageResponse } from "next/og";

import { Q_ICON_NAVY, qMarkSvg } from "@/components/brand/quill-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon: the white Q mark on navy (iOS rounds the corners itself). */
export default function AppleIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${qMarkSvg({ fg: "#FFFFFF", cut: Q_ICON_NAVY })}</svg>`;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: Q_ICON_NAVY,
      }}
    >
      <img
        width={150}
        height={150}
        alt=""
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      />
    </div>,
    size,
  );
}
