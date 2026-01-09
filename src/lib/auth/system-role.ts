import { db } from "@/lib/db"

export type SystemRole = "USER" | "STAFF" | "ADMIN"

export async function getSystemRole(userId: string): Promise<SystemRole> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  })
  return (user?.systemRole as SystemRole) || "USER"
}

export async function setSystemRole(userId: string, role: SystemRole): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { systemRole: role },
  })
}

/**
 * Check if a user can access a specific subdomain.
 * With path-based architecture, only "app" and "marketing" subdomains exist.
 * Role-based access is enforced at the path level, not subdomain level.
 */
export function canAccessSubdomain(systemRole: SystemRole, subdomain: string): boolean {
  // App subdomain is accessible by all authenticated users
  // Role restrictions are enforced at the path level (/admin, /staff)
  if (subdomain === "app") {
    return true
  }
  if (subdomain === "marketing") {
    return true // Public
  }
  return false
}

/**
 * Check if a user can access a specific path based on their role.
 * This replaces subdomain-based access control.
 */
export function canAccessPath(systemRole: SystemRole, pathname: string): boolean {
  if (pathname.startsWith("/admin")) {
    return systemRole === "ADMIN"
  }
  if (pathname.startsWith("/staff")) {
    return systemRole === "STAFF" || systemRole === "ADMIN"
  }
  // All other paths accessible by all authenticated users
  return true
}

/**
 * Get available paths for a given system role.
 * Replaces getAvailableSubdomains with path-based equivalents.
 */
export function getAvailablePaths(systemRole: SystemRole): string[] {
  switch (systemRole) {
    case "ADMIN":
      return ["/admin", "/staff", "/dashboard"]
    case "STAFF":
      return ["/staff", "/dashboard"]
    case "USER":
    default:
      return ["/dashboard"]
  }
}

/**
 * @deprecated Use getAvailablePaths instead. Subdomains are no longer used for role-based routing.
 */
export function getAvailableSubdomains(systemRole: SystemRole): string[] {
  // All roles now use the same subdomains (app for authenticated, marketing for public)
  return ["app"]
}

/**
 * Checks if a user has access to multiple portals based on their system role.
 *
 * - ADMIN: Can access admin, staff, and app portals
 * - STAFF: Can access staff and app portals
 * - USER: Can only access app portal
 *
 * This is used to determine if the role selection page should be shown after login.
 * Regular users (USER role) are redirected directly to the app portal since they
 * only have one option.
 *
 * AUDIT NOTE: This intentionally skips the role selection page for regular users
 * as they have no choice to make. Future enhancement: show welcome/company context
 * for first-time users or users with multiple companies.
 */
export function hasMultipleRoles(systemRole: SystemRole): boolean {
  return systemRole === "ADMIN" || systemRole === "STAFF"
}

/**
 * Checks if a user should see the role/portal selection page.
 *
 * Currently returns true only for STAFF and ADMIN users who can access
 * multiple portals (staff/app or admin/staff/app).
 *
 * Future enhancement: Also return true for users with access to multiple companies,
 * enabling them to select which company context to enter.
 *
 * @param userId - User ID to check
 * @param systemRole - User's system role (USER, STAFF, or ADMIN)
 * @returns true if role selection page should be shown
 */
export async function shouldShowRoleSelection(
  userId: string,
  systemRole: SystemRole
): Promise<boolean> {
  // STAFF and ADMIN always see role selection (multiple portal access)
  if (hasMultipleRoles(systemRole)) {
    return true
  }

  // Future: Check if user belongs to multiple companies
  // When multi-company switching is implemented, uncomment:
  /*
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      companies: {
        select: { id: true },
      },
    },
  })
  const companyCount = user?.companies.length || 0
  return companyCount > 1
  */

  // For now, regular users go directly to their single portal
  return false
}
