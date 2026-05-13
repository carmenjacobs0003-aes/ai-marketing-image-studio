import type { MetadataRoute } from "next";
import {
  BRAND_DESCRIPTION,
  BRAND_ICON_192_SRC,
  BRAND_ICON_512_SRC,
  BRAND_MASKABLE_ICON_SRC,
  BRAND_NAME,
  BRAND_OG_IMAGE_SRC,
  BRAND_SHORT_NAME
} from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? BRAND_NAME;

  return {
    name,
    short_name: BRAND_SHORT_NAME,
    description: process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? BRAND_DESCRIPTION,
    start_url: "/dashboard?source=pwa",
    scope: "/",
    id: "/?source=pwa",
    lang: "en-US",
    dir: "ltr",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    orientation: "portrait-primary",
    background_color: "#020617",
    theme_color: "#22d3ee",
    categories: ["business", "productivity", "graphics"],
    screenshots: [
      {
        src: BRAND_OG_IMAGE_SRC,
        sizes: "1200x630",
        type: "image/svg+xml"
      },
      {
        src: BRAND_ICON_512_SRC,
        sizes: "512x512",
        type: "image/svg+xml"
      }
    ],
    shortcuts: [
      {
        name: "Generate image",
        short_name: "Image",
        description: "Open Studio",
        url: "/studio?source=pwa-shortcut",
        icons: [
          {
            src: BRAND_ICON_192_SRC,
            sizes: "192x192",
            type: "image/svg+xml"
          }
        ]
      },
      {
        name: "Campaign content",
        short_name: "Copy",
        description: "Generate campaign content",
        url: "/marketing?source=pwa-shortcut",
        icons: [
          {
            src: BRAND_ICON_192_SRC,
            sizes: "192x192",
            type: "image/svg+xml"
          }
        ]
      }
    ],
    icons: [
      {
        src: BRAND_ICON_192_SRC,
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: BRAND_ICON_512_SRC,
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: BRAND_MASKABLE_ICON_SRC,
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
