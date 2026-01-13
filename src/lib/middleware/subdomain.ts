/**
 * Subdomain detection and routing utilities
 *
 * Architecture:
 * - www.fiskai.hr / fiskai.hr → marketing (static site, separate repo)
 * - app.fiskai.hr → application (all authenticated users)
 *
 * Roles are expressed via paths, not subdomains:
 * - /admin → Admin users only
 * - /staff → Staff users only
 * - /* → Regular users
 */

export type Subdomain = "app" | "marketing"

export function getSubdomain(host: string): Subdomain {
  // Remove port if present
  const hostname = host.split(":")[0]

  // Handle localhost development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Default to app in development for authenticated routes
    return "app"
  }

  // Extract subdomain from hostname
  const parts = hostname.split(".")

  // Expected format: subdomain.fiskai.hr or fiskai.hr
  if (parts.length >= 3) {
    const subdomain = parts[0]
    if (subdomain === "app") {
      return "app"
    }
    // Legacy admin/staff subdomains will be redirected by middleware
  }

  // Root domain (fiskai.hr) or www = marketing
  // Marketing is now served from separate static site
  return "marketing"
}

export function getSubdomainFromRequest(request: Request): Subdomain {
  const host = request.headers.get("host") || ""

  // Development override via header
  const subdomainOverride = request.headers.get("x-subdomain")
  if (subdomainOverride === "app") {
    return "app"
  }

  return getSubdomain(host)
}

export function getRouteGroupForSubdomain(subdomain: Subdomain): string {
  switch (subdomain) {
    case "app":
      return "(app)"
    case "marketing":
    default:
      return "(marketing)"
  }
}

/**
 * Get the dashboard path for a given system role
 * All roles access app.fiskai.hr, but are routed to different paths
 */
export function getDashboardPathForRole(systemRole: "USER" | "STAFF" | "ADMIN"): string {
  switch (systemRole) {
    case "ADMIN":
      return "/admin"
    case "STAFF":
      return "/staff"
    case "USER":
    default:
      return "/cc"
  }
}

/**
 * Check if a user can access a specific path based on their role
 */
export function canAccessPath(systemRole: string, pathname: string): boolean {
  if (pathname.startsWith("/admin")) {
    return systemRole === "ADMIN"
  }
  if (pathname.startsWith("/staff")) {
    return systemRole === "STAFF" || systemRole === "ADMIN"
  }
  // All other paths accessible by all authenticated users
  return true
}

// Legacy exports for backward compatibility - these will be removed after migration
export function getRedirectUrlForSystemRole(
  systemRole: "USER" | "STAFF" | "ADMIN",
  currentUrl: string
): string {
  try {
    const url = new URL(currentUrl)
    // All roles go to app subdomain now, just different paths
    const baseDomain = url.hostname.replace(/^(app|staff|admin|www)\./, "")
    const path = getDashboardPathForRole(systemRole)
    return `${url.protocol}//app.${baseDomain}${url.port ? `:${url.port}` : ""}${path}`
  } catch {
    return "/cc"
  }
}

export function canAccessSubdomain(systemRole: string, subdomain: string): boolean {
  // App subdomain is accessible by all authenticated users
  // Role restrictions are enforced at the path level, not subdomain level
  if (subdomain === "app") {
    return true
  }
  if (subdomain === "marketing") {
    return true // Public
  }
  return false
}
