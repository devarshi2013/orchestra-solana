import type { MetadataRoute } from "next";

import { TAGLINE } from "@/lib/brand";

/** Install metadata: the white mark on black (src/app/icon.svg), on a white page. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tickertape",
    short_name: "Tickertape",
    description: TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
