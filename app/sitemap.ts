import type { MetadataRoute } from "next";

const routes = ["", "/pricing", "/gallery", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    "https://ai-marketing-image-studio.vercel.app";
  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7
  }));
}
