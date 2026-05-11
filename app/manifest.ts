import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? "AI Marketing Image Studio";

  return {
    name,
    short_name: "AI Studio",
    description:
      process.env.NEXT_PUBLIC_APP_DESCRIPTION ??
      "Create campaign-ready marketing images and conversion copy with AI.",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#020617",
    theme_color: "#22d3ee",
    categories: ["business", "productivity", "graphics"],
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
