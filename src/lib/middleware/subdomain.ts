export type Subdomain = "app" | "staff" | "admin" | "marketing"

const SUBDOMAIN_MAP: Record<string, Subdomain> = {
  app: "app",
  staff: "staff",
  admin: "admin",
}

export function getSubdomain(host: string): Subdomain {
  // Remove port if present
  const hostname = host.split(":")[0]

  // Handle localhost development
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    // Default to marketing in development to allow access to public pages
    return "marketing"
  }

  // Extract subdomain from hostname
  const parts = hostname.split(".")

  // Expected format: subdomain.fiskai.hr or fiskai.hr
  if (parts.length >= 3) {
    const subdomain = parts[0]
    if (subdomain in SUBDOMAIN_MAP) {
      return SUBDOMAIN_MAP[subdomain]
    }
  }

  // Root domain = marketing
  return "marketing"
}

export function getSubdomainFromRequest(request: Request): Subdomain {
  const host = request.headers.get("host") || ""

  // Development override via header
  const subdomainOverride = request.headers.get("x-subdomain")
  if (subdomainOverride && subdomainOverride in SUBDOMAIN_MAP) {
    return SUBDOMAIN_MAP[subdomainOverride]
  }

  return getSubdomain(host)
}

export function getRouteGroupForSubdomain(subdomain: Subdomain): string {
  switch (subdomain) {
    case "admin":
      return "(admin)"
    case "staff":
      return "(staff)"
    case "app":
      return "(app)"
    case "marketing":
    default:
      return "(marketing)"
  }
}

export function getRedirectUrlForSystemRole(
  systemRole: "USER" | "STAFF" | "ADMIN",
  currentUrl: string
): string {
  try {
    const url = new URL(currentUrl)
    const protocol = url.protocol
    const port = url.port ? `:${url.port}` : ""
    let hostname = url.hostname

    // Strip www. if present
    if (hostname.startsWith("www.")) {
      hostname = hostname.replace(/^www\./, "")
    }

    // Strip existing subdomains (app, staff, admin) to get the base domain
    // We strictly match the known subdomains to avoid stripping parts of the actual domain name
    const baseDomain = hostname.replace(/^(app|staff|admin)\./, "")

    let targetSubdomain = ""
    switch (systemRole) {
      case "ADMIN":
        targetSubdomain = "admin."
        break
      case "STAFF":
        targetSubdomain = "staff."
        break
      case "USER":
      default:
        targetSubdomain = "app."
        break
    }

    // Special handling for localhost/preview URLs if they don't support subdomains
    // But typically for this architecture, we assume app.localhost is configured in /etc/hosts
    // or we are pointing to a domain that supports wildcard/subdomains.

    return `${protocol}//${targetSubdomain}${baseDomain}${port}`
  } catch (e) {
    // Fallback if URL parsing fails - root path lets middleware handle routing
    return "/"
  }
}

export function canAccessSubdomain(systemRole: string, subdomain: string): boolean {
  switch (subdomain) {
    case "admin":
      return systemRole === "ADMIN"
    case "staff":
      return systemRole === "STAFF" || systemRole === "ADMIN"
    case "app":
      return true // All roles can access app
    case "marketing":
      return true // Public
    default:
      return false
  }
}
