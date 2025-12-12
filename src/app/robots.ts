import type { MetadataRoute } from "next"

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/+$/, "")
  return "http://localhost:3000"
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/features", "/pricing", "/about", "/contact", "/security", "/privacy", "/terms"],
        disallow: ["/admin", "/api", "/dashboard", "/invoices", "/expenses", "/settings"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}

