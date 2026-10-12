import { ImageResponse } from "next/og";

import { MARK_INK, markSvg } from "@/components/brand/tickertape-mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon: the white mark on black, as on the favicon (iOS rounds the corners). */
export default function AppleIcon() {
  return new ImageResponse(
    <img
      width={180}
      height={180}
      alt=""
      src={`data:image/svg+xml;utf8,${encodeURIComponent(markSvg({ fg: "#FFFFFF", bg: MARK_INK }))}`}
    />,
    size,
  );
}
