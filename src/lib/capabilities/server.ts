/**
 * Server-side Capability Resolution
 *
 * Call capability resolution directly from server components
 * without HTTP round-trip.
 *
 * @module capabilities/server
 * @since Control Center Shells
 */

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { resolveCapabilities } from "./resolver"
import type { CapabilityResponse, CapabilityRequest, CapabilityMetadata } from "./types"

/**
 * Build user context from session for capability resolution.
 */
async function buildUserContext() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      systemRole: true,
      companies: {
        where: { isDefault: true },
        select: {
          companyId: true,
          role: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!user) {
    return null
  }

  // Fall back to first company if no default set
  const membership = user.companies[0]
  if (!membership) {
    return null
  }

  const permissions = buildPermissions(user.systemRole, membership.role)

  return {
    userId: user.id,
    companyId: membership.companyId,
    permissions,
  }
}

/**
 * Build permissions list based on system role and company role.
 */
function buildPermissions(systemRole: string, companyRole: string): string[] {
  const permissions: string[] = []

  // Base permissions for all authenticated users
  permissions.push("invoicing:read", "expenses:read", "banking:read")

  // Role-based permissions
  switch (companyRole) {
    case "OWNER":
    case "ADMIN":
      permissions.push(
        "invoicing:write",
        "invoicing:approve",
        "expenses:write",
        "expenses:approve",
        "banking:write",
        "reconciliation:write",
        "fiscalization:write",
        "payroll:read",
        "payroll:write",
        "payroll:approve",
        "assets:read",
        "assets:write",
        "gl:read",
        "gl:write",
        "admin:periods",
        "admin:users"
      )
      break

    case "ACCOUNTANT":
      permissions.push(
        "invoicing:write",
        "expenses:write",
        "expenses:approve",
        "banking:write",
        "reconciliation:write",
        "fiscalization:write",
        "payroll:read",
        "payroll:write",
        "assets:read",
        "assets:write",
        "gl:read",
        "gl:write"
      )
      break

    case "MEMBER":
      permissions.push("invoicing:write", "expenses:write", "banking:write")
      break

    case "VIEWER":
      // Read-only, no additional permissions
      break
  }

  // System role overrides
  if (systemRole === "ADMIN" || systemRole === "STAFF") {
    permissions.push("admin:periods", "admin:users", "admin:system")
  }

  return [...new Set(permissions)]
}

/**
 * Resolve capabilities for the current user.
 *
 * Use this in server components to get capability state.
 */
export async function resolveCapabilitiesForUser(
  capabilityIds: string[],
  context?: { entityId?: string; entityType?: string; targetDate?: string }
): Promise<CapabilityResponse[]> {
  const userContext = await buildUserContext()

  if (!userContext) {
    // Return UNAUTHORIZED for all capabilities
    return capabilityIds.map((id) => ({
      capability: id,
      state: "UNAUTHORIZED" as const,
      inputs: [],
      blockers: [],
      actions: [],
      resolvedAt: new Date().toISOString(),
    }))
  }

  const requests: CapabilityRequest[] = capabilityIds.map((id) => ({
    capability: id,
    context: {
      companyId: userContext.companyId,
      ...context,
    },
  }))

  return resolveCapabilities(db, requests, userContext)
}

/**
 * Resolve a single capability for the current user.
 */
export async function resolveCapabilityForUser(
  capabilityId: string,
  context?: { entityId?: string; entityType?: string; targetDate?: string }
): Promise<CapabilityResponse> {
  const results = await resolveCapabilitiesForUser([capabilityId], context)
  return results[0]
}

/**
 * Get all capabilities for a domain, resolved for current user.
 */
export async function resolveCapabilitiesByDomain(
  domain: CapabilityMetadata["domain"]
): Promise<CapabilityResponse[]> {
  const { getCapabilitiesByDomain } = await import("./registry")
  const capabilities = getCapabilitiesByDomain(domain)
  const ids = capabilities.map((c) => c.id)
  return resolveCapabilitiesForUser(ids)
}
