import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "@/styles/globals.css";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://ai-marketing-image-studio.vercel.app";
const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "AI Marketing Image Studio";
const description =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION ??
  "Create campaign-ready marketing images, ad creative, and conversion copy with AI.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: appName,
  title: {
    default: appName,
    template: `%s | ${appName}`
  },
  description,
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
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" }
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.svg",
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
        url: "/icons/og-image.svg",
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
    images: ["/icons/og-image.svg"]
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
          href="/icons/og-image.svg"
          media="(orientation: landscape)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/icon-512.svg"
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
