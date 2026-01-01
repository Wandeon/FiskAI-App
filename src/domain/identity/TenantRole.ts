// src/domain/identity/TenantRole.ts

/**
 * Roles that a user can have within a tenant (company)
 */
export const TenantRole = {
  OWNER: "OWNER" as const,
  ADMIN: "ADMIN" as const,
  MEMBER: "MEMBER" as const,
  ACCOUNTANT: "ACCOUNTANT" as const,
  VIEWER: "VIEWER" as const,

  values(): string[] {
    return [
      TenantRole.OWNER,
      TenantRole.ADMIN,
      TenantRole.MEMBER,
      TenantRole.ACCOUNTANT,
      TenantRole.VIEWER,
    ]
  },

  isValid(value: string): boolean {
    return TenantRole.values().includes(value)
  },

  /**
   * Check if a role has a specific permission
   */
  hasPermission(
    role:
      | typeof TenantRole.OWNER
      | typeof TenantRole.ADMIN
      | typeof TenantRole.MEMBER
      | typeof TenantRole.ACCOUNTANT
      | typeof TenantRole.VIEWER,
    permission: string
  ): boolean {
    const permissions = ROLE_PERMISSIONS[role] ?? []
    return permissions.includes(permission)
  },

  /**
   * Compare roles by hierarchy level
   * Returns positive if a > b, negative if a < b, 0 if equal
   */
  compare(
    a:
      | typeof TenantRole.OWNER
      | typeof TenantRole.ADMIN
      | typeof TenantRole.MEMBER
      | typeof TenantRole.ACCOUNTANT
      | typeof TenantRole.VIEWER,
    b:
      | typeof TenantRole.OWNER
      | typeof TenantRole.ADMIN
      | typeof TenantRole.MEMBER
      | typeof TenantRole.ACCOUNTANT
      | typeof TenantRole.VIEWER
  ): number {
    return ROLE_HIERARCHY[a] - ROLE_HIERARCHY[b]
  },
}

export type TenantRoleType =
  | typeof TenantRole.OWNER
  | typeof TenantRole.ADMIN
  | typeof TenantRole.MEMBER
  | typeof TenantRole.ACCOUNTANT
  | typeof TenantRole.VIEWER

/**
 * Role hierarchy - higher number = more privileges
 */
const ROLE_HIERARCHY: Record<string, number> = {
  [TenantRole.VIEWER]: 1,
  [TenantRole.ACCOUNTANT]: 2,
  [TenantRole.MEMBER]: 3,
  [TenantRole.ADMIN]: 4,
  [TenantRole.OWNER]: 5,
}

/**
 * Permissions for each role
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  [TenantRole.OWNER]: [
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
  [TenantRole.ADMIN]: [
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
  [TenantRole.MEMBER]: [
    // Standard business operations
    "view_invoices",
    "create_invoices",
    "edit_invoices",
    "view_reports",
  ],
  [TenantRole.ACCOUNTANT]: [
    // Financial view and reporting
    "view_invoices",
    "view_reports",
    "export_data",
  ],
  [TenantRole.VIEWER]: [
    // Read-only access
    "view_invoices",
    "view_reports",
  ],
}
