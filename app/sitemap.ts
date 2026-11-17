import type { MetadataRoute } from "next";
import { FEATURED, SITE_URL, featuredPath } from "@/lib/featured";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...FEATURED.map((p) => ({
      url: `${SITE_URL}${featuredPath(p)}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
