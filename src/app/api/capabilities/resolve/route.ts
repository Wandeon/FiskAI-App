/**
 * Capability Resolution API
 *
 * POST /api/capabilities/resolve
 *
 * Resolves one or more capabilities to determine:
 * - Current state (READY, BLOCKED, MISSING_INPUTS, UNAUTHORIZED)
 * - Required and optional inputs
 * - Active blockers preventing execution
 * - Available actions
 *
 * @module api/capabilities
 * @since Enterprise Hardening
 */

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { db } from "@/lib/db"
import {
  resolveCapability,
  resolveCapabilities,
  type CapabilityRequest,
  type CapabilityResponse,
} from "@/lib/capabilities"

/**
 * Request body schema.
 */
interface RequestBody {
  /** Single capability request */
  capability?: CapabilityRequest

  /** Multiple capability requests (batch mode) */
  capabilities?: CapabilityRequest[]
}

/**
 * Response schema.
 */
interface ApiResponse {
  /** Single capability response */
  result?: CapabilityResponse

  /** Multiple capability responses (batch mode) */
  results?: CapabilityResponse[]
}

/**
 * POST /api/capabilities/resolve
 *
 * Resolve capabilities to determine what actions are available.
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse | { error: string }>> {
  try {
    // Authenticate
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's company and permissions
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        systemRole: true,
        companyMemberships: {
          where: { isActive: true },
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
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const membership = user.companyMemberships[0]
    if (!membership) {
      return NextResponse.json({ error: "No active company membership" }, { status: 403 })
    }

    // Build user context with permissions
    const permissions = buildPermissions(user.systemRole, membership.role)

    const userContext = {
      userId: user.id,
      companyId: membership.companyId,
      permissions,
    }

    // Parse request body
    const body = (await request.json()) as RequestBody

    // Handle batch mode
    if (body.capabilities && Array.isArray(body.capabilities)) {
      const results = await resolveCapabilities(db, body.capabilities, userContext)
      return NextResponse.json({ results })
    }

    // Handle single capability
    if (body.capability) {
      const result = await resolveCapability(db, body.capability, userContext)
      return NextResponse.json({ result })
    }

    return NextResponse.json(
      { error: "Request must include 'capability' or 'capabilities'" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Capability resolution error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
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
      permissions.push(
        "invoicing:write",
        "expenses:write",
        "banking:write"
      )
      break

    case "VIEWER":
      // Read-only, no additional permissions
      break
  }

  // System role overrides
  if (systemRole === "ADMIN" || systemRole === "STAFF") {
    permissions.push(
      "admin:periods",
      "admin:users",
      "admin:system"
    )
  }

  return [...new Set(permissions)] // Deduplicate
}
