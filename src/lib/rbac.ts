/**
 * Role-Based Access Control (RBAC) Permission System
 *
 * This module defines permissions for different roles and provides
 * functions to check if a user has permission to perform an action.
 */

import { db } from "@/lib/db"
import { Role } from "@prisma/client"

/**
 * Permission matrix mapping actions to allowed roles
 */
export const PERMISSIONS = {
  // Invoice permissions
  "invoice:create": ["OWNER", "ADMIN", "MEMBER"],
  "invoice:read": ["OWNER", "ADMIN", "MEMBER", "ACCOUNTANT", "VIEWER"],
  "invoice:update": ["OWNER", "ADMIN", "MEMBER"],
  "invoice:delete": ["OWNER", "ADMIN"],

  // Expense permissions
  "expense:create": ["OWNER", "ADMIN", "MEMBER"],
  "expense:read": ["OWNER", "ADMIN", "MEMBER", "ACCOUNTANT", "VIEWER"],
  "expense:update": ["OWNER", "ADMIN", "MEMBER"],
  "expense:delete": ["OWNER", "ADMIN"],

  // Contact permissions
  "contact:create": ["OWNER", "ADMIN", "MEMBER"],
  "contact:read": ["OWNER", "ADMIN", "MEMBER", "ACCOUNTANT", "VIEWER"],
  "contact:update": ["OWNER", "ADMIN", "MEMBER"],
  "contact:delete": ["OWNER", "ADMIN"],

  // Product permissions
  "product:create": ["OWNER", "ADMIN", "MEMBER"],
  "product:read": ["OWNER", "ADMIN", "MEMBER", "ACCOUNTANT", "VIEWER"],
  "product:update": ["OWNER", "ADMIN", "MEMBER"],
  "product:delete": ["OWNER", "ADMIN"],

  // Company settings
  "settings:read": ["OWNER", "ADMIN", "ACCOUNTANT"],
  "settings:update": ["OWNER", "ADMIN"],
  "billing:manage": ["OWNER"],

  // User management
  "users:invite": ["OWNER", "ADMIN"],
  "users:remove": ["OWNER", "ADMIN"],
  "users:update_role": ["OWNER"],

  // Reports
  "reports:read": ["OWNER", "ADMIN", "ACCOUNTANT", "VIEWER"],
  "reports:export": ["OWNER", "ADMIN", "ACCOUNTANT"],

  // Bank accounts
  "bank_account:create": ["OWNER", "ADMIN"],
  "bank_account:read": ["OWNER", "ADMIN", "ACCOUNTANT", "VIEWER"],
  "bank_account:update": ["OWNER", "ADMIN"],
  "bank_account:delete": ["OWNER", "ADMIN"],

  // Fiscal/Certificate management
  "fiscal:manage": ["OWNER", "ADMIN"],

  // Expense categories
  "expense_category:create": ["OWNER", "ADMIN"],
  "expense_category:read": ["OWNER", "ADMIN", "MEMBER", "ACCOUNTANT", "VIEWER"],
  "expense_category:update": ["OWNER", "ADMIN"],
  "expense_category:delete": ["OWNER", "ADMIN"],

  // Company data export
  "company:export": ["OWNER", "ADMIN"],
} as const

export type Permission = keyof typeof PERMISSIONS

/**
 * Get the user's role for a specific company
 */
export async function getUserRole(userId: string, companyId: string): Promise<Role | null> {
  const companyUser = await db.companyUser.findUnique({
    where: {
      userId_companyId: {
        userId,
        companyId,
      },
    },
    select: {
      role: true,
    },
  })

  return companyUser?.role ?? null
}

/**
 * Check if a user has a specific permission for a company
 *
 * @param userId - The user ID to check
 * @param companyId - The company ID to check access for
 * @param permission - The permission to check (e.g., 'invoice:delete')
 * @returns Promise<boolean> - true if user has permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  companyId: string,
  permission: Permission
): Promise<boolean> {
  const role = await getUserRole(userId, companyId)

  if (!role) {
    return false
  }

  const allowedRoles = PERMISSIONS[permission] as readonly Role[]
  return allowedRoles.includes(role)
}

/**
 * Require a user to have a specific permission for a company
 * Throws an error if the user doesn't have permission
 *
 * @param userId - The user ID to check
 * @param companyId - The company ID to check access for
 * @param permission - The permission to require (e.g., 'invoice:delete')
 * @throws Error if user doesn't have permission
 */
export async function requirePermission(
  userId: string,
  companyId: string,
  permission: Permission
): Promise<void> {
  const allowed = await hasPermission(userId, companyId, permission)

  if (!allowed) {
    const role = await getUserRole(userId, companyId)
    throw new Error(
      `Permission denied: User with role ${role ?? "NONE"} does not have permission '${permission}'`
    )
  }
}

/**
 * Check if a role has a specific permission (without database lookup)
 * Useful for UI rendering decisions when you already know the user's role
 *
 * @param role - The role to check
 * @param permission - The permission to check
 * @returns boolean - true if role has permission, false otherwise
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission] as readonly Role[]
  return allowedRoles.includes(role)
}
