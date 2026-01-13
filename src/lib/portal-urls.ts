/**
 * Portal URL Helper
 *
 * Single source of truth for cross-portal navigation.
 * Used by: MarketingHeader, auth flows, email templates
 *
 * Architecture:
 * - Uses environment variables for base domain
 * - Provides type-safe portal URL generation
 * - Works in both client and server contexts
 */

export type Portal = "marketing" | "app" | "staff" | "admin"

/**
 * Get the base domain from environment.
 * Falls back to fiskai.hr for production.
 */
function getBaseDomain(): string {
  // NEXT_PUBLIC_APP_URL should be set to https://fiskai.hr in production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

  try {
    const url = new URL(appUrl)
    // Extract base domain (e.g., "fiskai.hr" from "https://fiskai.hr")
    return url.hostname.replace(/^(app|staff|admin)\./, "")
  } catch {
    return "fiskai.hr"
  }
}

/**
 * Get the protocol from environment.
 */
function getProtocol(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"
  try {
    const url = new URL(appUrl)
    return url.protocol
  } catch {
    return "https:"
  }
}

/**
 * Get the full base URL for a specific portal.
 *
 * Architecture (2026-01):
 * - All portals are now served from app.fiskai.hr with path-based routing
 * - admin.fiskai.hr and staff.fiskai.hr subdomains have been permanently removed
 * - Use app.fiskai.hr/admin and app.fiskai.hr/staff instead
 *
 * @example
 * getPortalBaseUrl("app") // "https://app.fiskai.hr"
 * getPortalBaseUrl("staff") // "https://app.fiskai.hr" (path added by getPortalUrl)
 * getPortalBaseUrl("admin") // "https://app.fiskai.hr" (path added by getPortalUrl)
 * getPortalBaseUrl("marketing") // "https://www.fiskai.hr"
 */
export function getPortalBaseUrl(portal: Portal): string {
  const baseDomain = getBaseDomain()
  const protocol = getProtocol()

  if (portal === "marketing") {
    // Marketing site is on www subdomain
    return `${protocol}//www.${baseDomain}`
  }

  // All app portals (app, staff, admin) are served from app.fiskai.hr
  return `${protocol}//app.${baseDomain}`
}

/**
 * Get a full URL for a specific portal and path.
 *
 * Architecture (2026-01):
 * - staff and admin portals use path prefixes on app.fiskai.hr
 * - app portal uses app.fiskai.hr directly
 * - marketing uses www.fiskai.hr
 *
 * @example
 * getPortalUrl("app", "/dashboard") // "https://app.fiskai.hr/dashboard"
 * getPortalUrl("staff", "/clients") // "https://app.fiskai.hr/staff/clients"
 * getPortalUrl("admin", "/tenants") // "https://app.fiskai.hr/admin/tenants"
 * getPortalUrl("marketing", "/pricing") // "https://www.fiskai.hr/pricing"
 */
export function getPortalUrl(portal: Portal, path: string = "/"): string {
  const baseUrl = getPortalBaseUrl(portal)
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`

  // Staff and admin portals use path prefixes
  if (portal === "staff" || portal === "admin") {
    // Avoid double prefix if path already starts with /staff or /admin
    if (normalizedPath.startsWith(`/${portal}`)) {
      return `${baseUrl}${normalizedPath}`
    }
    return `${baseUrl}/${portal}${normalizedPath === "/" ? "" : normalizedPath}`
  }

  return `${baseUrl}${normalizedPath}`
}

/**
 * Get the app portal URL (client dashboard).
 * This is the most common cross-portal link from marketing.
 */
export function getAppUrl(path: string = "/"): string {
  return getPortalUrl("app", path)
}

/**
 * Get the staff portal URL.
 */
export function getStaffUrl(path: string = "/"): string {
  return getPortalUrl("staff", path)
}

/**
 * Get the admin portal URL.
 */
export function getAdminUrl(path: string = "/"): string {
  return getPortalUrl("admin", path)
}

/**
 * Get the marketing site URL.
 */
export function getMarketingUrl(path: string = "/"): string {
  return getPortalUrl("marketing", path)
}

/**
 * Get the auth URL (login/register).
 * Auth is now hosted on app.fiskai.hr/auth
 */
export function getAuthUrl(): string {
  return getPortalUrl("app", "/auth")
}

/**
 * Determine which portal the current request is being served from.
 * Useful for server components that need portal context.
 */
export function detectPortalFromHost(host: string): Portal {
  const hostname = host.split(":")[0] // Remove port if present

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "marketing" // Default for local development
  }

  const parts = hostname.split(".")
  if (parts.length >= 3) {
    const subdomain = parts[0]
    if (subdomain === "app" || subdomain === "staff" || subdomain === "admin") {
      return subdomain
    }
  }

  return "marketing"
}

/**
 * Client-side helper to detect current portal.
 * Only use in client components.
 */
export function getCurrentPortal(): Portal {
  if (typeof window === "undefined") {
    return "marketing" // SSR fallback
  }

  return detectPortalFromHost(window.location.host)
}

/**
 * Check if we're on a protected portal (not marketing).
 */
export function isProtectedPortal(portal: Portal): boolean {
  return portal !== "marketing"
}

/**
 * Get the default landing path for a portal after login.
 * These are the control-center paths that middleware redirects to.
 */
export function getDefaultLandingPath(portal: Portal): string {
  switch (portal) {
    case "app":
      return "/cc"
    case "staff":
      return "/staff-control-center"
    case "admin":
      return "/admin-control-center"
    case "marketing":
    default:
      return "/"
  }
}
