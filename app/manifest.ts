import type { MetadataRoute } from "next";
import { BRAND_DESCRIPTION, BRAND_NAME } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? BRAND_NAME;

  return {
    name,
    short_name: "SYNTRIX AI",
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
        src: "/icons/og-image.svg",
        sizes: "1200x630",
        type: "image/svg+xml"
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml"
      }
    ],
    shortcuts: [
      {
        name: "Generate image",
        short_name: "Image",
        description: "Open the image studio",
        url: "/studio?source=pwa-shortcut",
        icons: [
          {
            src: "/icons/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml"
          }
        ]
      },
      {
        name: "Marketing copy",
        short_name: "Copy",
        description: "Generate campaign copy",
        url: "/marketing?source=pwa-shortcut",
        icons: [
          {
            src: "/icons/icon-192.svg",
            sizes: "192x192",
            type: "image/svg+xml"
          }
        ]
      }
    ],
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
