import type { MetadataRoute } from "next";

import { TAGLINE } from "@/lib/brand";

/** Install metadata: the navy nib on white, in the brand's colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quill",
    short_name: "Quill",
    description: TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#07090D",
    theme_color: "#0F1B2D",
    icons: [
      { src: "/brand/quill-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/quill-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/quill-q-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
