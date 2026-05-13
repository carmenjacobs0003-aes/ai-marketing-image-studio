import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import {
  BRAND_APPLE_TOUCH_ICON_SRC,
  BRAND_DESCRIPTION,
  BRAND_ICON_192_SRC,
  BRAND_ICON_512_SRC,
  BRAND_ICON_SRC,
  BRAND_METADATA_TITLE,
  BRAND_NAME,
  BRAND_OG_IMAGE_SRC
} from "@/lib/branding";
import "@/styles/globals.css";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://www.syntrixai.co.uk";
const appName = process.env.NEXT_PUBLIC_APP_NAME ?? BRAND_NAME;
const metadataTitle = process.env.NEXT_PUBLIC_APP_NAME ?? BRAND_METADATA_TITLE;
const description =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION ?? BRAND_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: appName,
  title: {
    default: metadataTitle,
    template: `%s | ${metadataTitle}`
  },
  description,
  verification: {
  google: "dZXbMwxccSadp8u4NiSQagPM2v40Xq2Fkm5eD31B2kI"
},
  keywords: [
    "AI marketing images",
    "AI ad creative",
    "marketing content studio",
    "AI image generator",
    "campaign creative"
  ],
  authors: [{ name: appName }],
  creator: appName,
  publisher: appName,
  alternates: {
    canonical: "/"
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: BRAND_ICON_SRC, type: "image/svg+xml" },
      { url: BRAND_ICON_192_SRC, sizes: "192x192", type: "image/svg+xml" },
      { url: BRAND_ICON_512_SRC, sizes: "512x512", type: "image/svg+xml" }
    ],
    apple: [
      {
        url: BRAND_APPLE_TOUCH_ICON_SRC,
        sizes: "180x180",
        type: "image/svg+xml"
      }
    ]
  },
  openGraph: {
    type: "website",
    url: appUrl,
    siteName: appName,
    title: appName,
    description,
    images: [
      {
        url: BRAND_OG_IMAGE_SRC,
        width: 1200,
        height: 630,
        alt: `${appName} neon blue AI creative dashboard`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description,
    images: [BRAND_OG_IMAGE_SRC]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: appName
  },
  category: "productivity",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "format-detection": "telephone=no",
    "msapplication-TileColor": "#020617",
    "msapplication-tap-highlight": "no"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#22d3ee",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="apple-touch-startup-image"
          href={BRAND_OG_IMAGE_SRC}
          media="(orientation: landscape)"
        />
        <link
          rel="apple-touch-startup-image"
          href={BRAND_ICON_512_SRC}
          media="(orientation: portrait)"
        />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
