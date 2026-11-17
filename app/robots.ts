import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/featured";

export default function robots(): MetadataRoute.Robots {
  // Previews are private and never indexed; only production invites crawlers.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
