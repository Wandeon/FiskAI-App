"use server"

/**
 * Capability Action Executor
 *
 * Server action that validates capability state before dispatching to handlers.
 * This is the main entry point for executing capability-driven actions.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { getActionHandler } from "./registry"
import { resolveCapabilityForUser } from "../server"
import type { ActionResult, ActionContext } from "./types"
import type { ExecuteActionInput } from "./executor.types"

// Import handlers to register them
import "./handlers/invoice"
import "./handlers/expense"
import "./handlers/bank"

/**
 * Build permissions list based on system role and company role.
 * Duplicated from server.ts to avoid circular dependency issues.
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
 * Execute a capability action with full validation.
 *
 * This function:
 * 1. Validates user session
 * 2. Looks up the action handler
 * 3. Gets user context (userId, companyId)
 * 4. Resolves capability state
 * 5. Checks capability is READY and action is enabled
 * 6. Executes the handler
 *
 * @param input - The action execution input
 * @returns ActionResult with success/failure and any data
 *
 * @example
 * ```typescript
 * const result = await executeCapabilityAction({
 *   capabilityId: "INV-003",
 *   actionId: "fiscalize",
 *   entityId: "invoice-123",
 * })
 *
 * if (result.success) {
 *   console.log("Fiscalized:", result.data)
 * } else {
 *   console.error("Failed:", result.error, result.code)
 * }
 * ```
 */
export async function executeCapabilityAction(input: ExecuteActionInput): Promise<ActionResult> {
  const { capabilityId, actionId, entityId, entityType, params } = input

  // 1. Validate session
  const session = await auth()
  if (!session?.user?.id) {
    return {
      success: false,
      error: "Authentication required",
      code: "UNAUTHORIZED",
    }
  }

  // 2. Get handler from registry
  const handlerEntry = getActionHandler(capabilityId, actionId)
  if (!handlerEntry) {
    return {
      success: false,
      error: `Action handler not found: ${capabilityId}:${actionId}`,
      code: "NOT_FOUND",
    }
  }

  // 3. Get user context
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

  // Fall back to first company if no default
  if (!user || user.companies.length === 0) {
    return {
      success: false,
      error: "No company context available",
      code: "UNAUTHORIZED",
    }
  }

  const membership = user.companies[0]
  const permissions = buildPermissions(user.systemRole, membership.role)

  // 4. Resolve capability
  const capability = await resolveCapabilityForUser(capabilityId, {
    entityId,
    entityType,
  })

  // 5. Check capability state
  if (capability.state === "BLOCKED") {
    const blocker = capability.blockers[0]
    return {
      success: false,
      error: blocker?.message || "Action is blocked",
      code: "CAPABILITY_BLOCKED",
      details: blocker
        ? {
            blockerType: blocker.type,
            resolution: blocker.resolution,
          }
        : undefined,
    }
  }

  if (capability.state === "UNAUTHORIZED") {
    return {
      success: false,
      error: "Not authorized to perform this action",
      code: "UNAUTHORIZED",
    }
  }

  if (capability.state === "MISSING_INPUTS") {
    return {
      success: false,
      error: "Required inputs are missing",
      code: "VALIDATION_ERROR",
    }
  }

  // Check if action is enabled
  const action = capability.actions.find((a) => a.id === actionId)
  if (!action || !action.enabled) {
    return {
      success: false,
      error: action?.disabledReason || "Action is not available",
      code: "CAPABILITY_BLOCKED",
    }
  }

  // 6. Build context and execute handler
  const context: ActionContext = {
    userId: user.id,
    companyId: membership.companyId,
    entityId,
    entityType,
    permissions,
  }

  // Merge entityId into params as 'id' for handler convenience
  const handlerParams = entityId ? { id: entityId, ...params } : params

  try {
    const result = await handlerEntry.handler(context, handlerParams)
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      code: "INTERNAL_ERROR",
    }
  }
}
