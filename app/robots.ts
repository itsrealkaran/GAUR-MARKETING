import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/r/", "/link"],
    },
    sitemap: "https://gaurmarketing.com/sitemap.xml",
  }
}
