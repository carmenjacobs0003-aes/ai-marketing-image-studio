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
        
        <div
          dangerouslySetInnerHTML={{
            __html: `
      <!-- BEGIN AADS AD UNIT 2437523 -->
      <div style="position: absolute; z-index: 99999">
        <input autocomplete="off" type="checkbox" id="aadsstickymp4h39x7" hidden />
       <div style="padding-top: 0; padding-bottom: auto;">
         <div style="width:100%;height:auto;position:fixed;text-align:center;font-size:0;bottom:0;left:0;right:0;margin:auto">
            <label for="aadsstickymp4h39x7" style="top: 50%;transform: translateY(-50%);right:24px; position: absolute;border-radius: 4px; background: rgba(248, 248, 249, 0.70); padding: 4px;z-index: 99999;cursor:pointer">
              <svg fill="#000000" height="16px" width="16px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490 490">
               <polygon points="456.851,0 245,212.564 33.149,0 0.708,32.337 212.669,245.004 0.708,457.678 33.149,490 245,277.443 456.851,490 489.292,457.678 277.331,245.004 489.292,32.337"/>
              </svg>
            </label>

            <div id="frame" style="width: 100%;margin: auto;position: relative; z-index: 99998;">
              <iframe
                data-aa="2437523"
                src="//acceptable.a-ads.com/2437523/?size=Adaptive"
                style="border:0; padding:0; width:70%; height:auto; overflow:hidden; margin:auto"
              ></iframe>
            </div>
          </div>

          <style>
            #aadsstickymp4h39x7:checked + div {
              display: none;
            }
          </style>
        </div>
      </div>
      <!-- END AADS AD UNIT 2437523 -->
`
          }}
        />
        
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
