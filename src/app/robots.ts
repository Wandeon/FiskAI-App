import type { MetadataRoute } from "next"
import {
  routes,
  getCanonicalBaseUrl,
  isProductionSitemap,
  type RouteCategory,
} from "@/config/routes"

/**
 * Enterprise Robots.txt Generator
 *
 * Features:
 * - Derives allow/disallow from route registry
 * - Blocks all auth, app, staff, admin routes
 * - Environment-safe (blocks everything in non-production)
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = getCanonicalBaseUrl()

  // Safety: Block everything in non-production environments
  if (!isProductionSitemap() || !baseUrl) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    }
  }

  // Categories that should be indexed
  const indexableCategories: RouteCategory[] = [
    "core",
    "marketing",
    "tools",
    "content",
    "news",
    "legal",
  ]

  // Get all indexable routes from registry
  const allowedPaths = Object.values(routes)
    .filter((r) => r.sitemap && indexableCategories.includes(r.category))
    .map((r) => r.path.hr)

  return {
    rules: [
      {
        userAgent: "*",
        allow: allowedPaths,
        disallow: [
          // Auth routes (from registry, category: auth)
          "/login",
          "/register",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          "/check-email",
          "/select-role",

          // App routes (authenticated users only)
          "/dashboard",
          "/dashboard/*",
          "/invoices",
          "/invoices/*",
          "/e-invoices",
          "/e-invoices/*",
          "/expenses",
          "/expenses/*",
          "/contacts",
          "/contacts/*",
          "/products",
          "/products/*",
          "/banking",
          "/banking/*",
          "/reports",
          "/reports/*",
          "/settings",
          "/settings/*",
          "/pausalni",
          "/pausalni/*",
          "/documents",
          "/documents/*",
          "/support",
          "/support/*",
          "/onboarding",
          "/checklist",
          "/compliance",
          "/accountant",
          "/asistent",
          "/pos",
          "/article-agent",
          "/article-agent/*",

          // Staff portal
          "/staff",
          "/staff/*",

          // Admin portal
          "/admin",
          "/admin/*",
          "/admin-login",
          // API routes
          "/api",
          "/api/*",

          // Next.js internals
          "/_next",
          "/_next/*",

          // Common crawler traps
          "/wp-admin",
          "/wp-login",
          "/.env",
          "/*.json$",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
