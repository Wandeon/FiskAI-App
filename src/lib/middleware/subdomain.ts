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
  baseUrl: string
): string {
  const url = new URL(baseUrl)
  const baseDomain = url.hostname.replace(/^(app|staff|admin)\./, "")

  switch (systemRole) {
    case "ADMIN":
      return `${url.protocol}//admin.${baseDomain}`
    case "STAFF":
      return `${url.protocol}//staff.${baseDomain}`
    case "USER":
    default:
      return `${url.protocol}//app.${baseDomain}`
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
