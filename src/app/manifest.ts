import type { MetadataRoute } from "next";

import { TAGLINE } from "@/lib/brand";

/** Install metadata: the nib on cream, in the brand's colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quill",
    short_name: "Quill",
    description: TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#F6EFE4",
    theme_color: "#6B1E2E",
    icons: [
      { src: "/brand/quill-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/quill-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/quill-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
