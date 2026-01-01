// src/domain/identity/TenantRole.ts

/**
 * Roles that a user can have within a tenant (company)
 */
const OWNER = "OWNER" as const
const ADMIN = "ADMIN" as const
const MEMBER = "MEMBER" as const
const ACCOUNTANT = "ACCOUNTANT" as const
const VIEWER = "VIEWER" as const

const TENANT_ROLE_VALUES = [OWNER, ADMIN, MEMBER, ACCOUNTANT, VIEWER] as const

/**
 * Role hierarchy - higher number = more privileges
 */
const ROLE_HIERARCHY: Record<string, number> = {
  [VIEWER]: 1,
  [ACCOUNTANT]: 2,
  [MEMBER]: 3,
  [ADMIN]: 4,
  [OWNER]: 5,
}

/**
 * Permissions for each role
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  [OWNER]: [
    // All permissions
    "delete_tenant",
    "manage_members",
    "manage_settings",
    "view_invoices",
    "create_invoices",
    "edit_invoices",
    "delete_invoices",
    "view_reports",
    "export_data",
    "manage_integrations",
  ],
  [ADMIN]: [
    // All except delete_tenant
    "manage_members",
    "manage_settings",
    "view_invoices",
    "create_invoices",
    "edit_invoices",
    "delete_invoices",
    "view_reports",
    "export_data",
    "manage_integrations",
  ],
  [MEMBER]: [
    // Standard business operations
    "view_invoices",
    "create_invoices",
    "edit_invoices",
    "view_reports",
  ],
  [ACCOUNTANT]: [
    // Financial view and reporting
    "view_invoices",
    "view_reports",
    "export_data",
  ],
  [VIEWER]: [
    // Read-only access
    "view_invoices",
    "view_reports",
  ],
}

export const TenantRole = {
  OWNER,
  ADMIN,
  MEMBER,
  ACCOUNTANT,
  VIEWER,

  values(): readonly string[] {
    return TENANT_ROLE_VALUES
  },

  isValid(value: string): boolean {
    return (TENANT_ROLE_VALUES as readonly string[]).includes(value)
  },

  /**
   * Check if a role has a specific permission
   */
  hasPermission(role: TenantRoleType, permission: string): boolean {
    const permissions = ROLE_PERMISSIONS[role] ?? []
    return permissions.includes(permission)
  },

  /**
   * Compare roles by hierarchy level
   * Returns positive if a > b, negative if a < b, 0 if equal
   */
  compare(a: TenantRoleType, b: TenantRoleType): number {
    return ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b]
  },
} as const

export type TenantRoleType = (typeof TENANT_ROLE_VALUES)[number]
