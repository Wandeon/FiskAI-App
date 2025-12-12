import type { MetadataRoute } from "next"

function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/+$/, "")
  return "http://localhost:3000"
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl()
  const now = new Date()

  const routes = ["/", "/features", "/pricing", "/about", "/contact", "/security", "/privacy", "/terms"]
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7,
  }))
}

