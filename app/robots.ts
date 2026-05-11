import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://www.syntrixai.co.uk/";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/gallery", "/privacy", "/terms"],
        disallow: ["/dashboard", "/admin", "/api", "/settings", "/billing"]
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl
  };
}
