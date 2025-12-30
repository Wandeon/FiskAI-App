/**
 * Granular Module Permissions System
 *
 * Provides CRUD-style permissions for each module, enabling fine-grained
 * access control beyond simple module enable/disable.
 */

import type { ModuleKey } from "./definitions"

/**
 * Permission actions that can be granted per module
 */
export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete", "export", "admin"] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

/**
 * Full permission identifier: module:action (e.g., "invoicing:create")
 */
export type Permission = `${ModuleKey}:${PermissionAction}`

/**
 * Entitlement with optional expiration for trial features
 */
export interface ModuleEntitlement {
  moduleKey: ModuleKey
  permissions: PermissionAction[]
  expiresAt?: Date | null
  grantedAt: Date
  grantedBy: string
  reason?: string
}

/**
 * Company entitlements structure stored in JSON
 */
export interface CompanyEntitlements {
  version: 2
  modules: Record<ModuleKey, ModuleEntitlement | null>
  subscriptionPlan?: string
}

/**
 * Legacy entitlements format (v1 - just array of module keys)
 */
export type LegacyEntitlements = ModuleKey[]

/**
 * Default permissions granted when a module is enabled
 */
export const DEFAULT_MODULE_PERMISSIONS: PermissionAction[] = ["view", "create", "edit", "delete"]

/**
 * Full admin permissions (all actions)
 */
export const ADMIN_PERMISSIONS: PermissionAction[] = [...PERMISSION_ACTIONS]

/**
 * View-only permissions for restricted access
 */
export const VIEW_ONLY_PERMISSIONS: PermissionAction[] = ["view", "export"]

/**
 * Subscription plan entitlement defaults
 */
export const PLAN_DEFAULTS: Record<
  string,
  { modules: ModuleKey[]; permissions: PermissionAction[] }
> = {
  free: {
    modules: ["platform-core", "invoicing", "contacts", "products", "documents"],
    permissions: ["view", "create", "edit", "delete"],
  },
  starter: {
    modules: [
      "platform-core",
      "invoicing",
      "e-invoicing",
      "contacts",
      "products",
      "expenses",
      "documents",
      "reports-basic",
    ],
    permissions: ["view", "create", "edit", "delete", "export"],
  },
  professional: {
    modules: [
      "platform-core",
      "invoicing",
      "e-invoicing",
      "contacts",
      "products",
      "expenses",
      "documents",
      "reports-basic",
      "reports-advanced",
      "banking",
      "reconciliation",
      "vat",
    ],
    permissions: ["view", "create", "edit", "delete", "export"],
  },
  enterprise: {
    modules: [
      "platform-core",
      "invoicing",
      "e-invoicing",
      "fiscalization",
      "contacts",
      "products",
      "expenses",
      "banking",
      "reconciliation",
      "reports-basic",
      "reports-advanced",
      "pausalni",
      "vat",
      "corporate-tax",
      "pos",
      "documents",
      "ai-assistant",
    ],
    permissions: ADMIN_PERMISSIONS,
  },
}

/**
 * Check if entitlements use the new format (v2)
 */
export function isV2Entitlements(entitlements: unknown): entitlements is CompanyEntitlements {
  return (
    typeof entitlements === "object" &&
    entitlements !== null &&
    "version" in entitlements &&
    (entitlements as CompanyEntitlements).version === 2
  )
}

/**
 * Migrate legacy entitlements (array of module keys) to v2 format
 */
export function migrateEntitlements(
  legacy: LegacyEntitlements,
  grantedBy: string = "system"
): CompanyEntitlements {
  const modules = {} as Record<ModuleKey, ModuleEntitlement | null>

  for (const moduleKey of legacy) {
    modules[moduleKey] = {
      moduleKey,
      permissions: DEFAULT_MODULE_PERMISSIONS,
      grantedAt: new Date(),
      grantedBy,
      reason: "Migrated from legacy entitlements",
    }
  }

  return {
    version: 2,
    modules,
  }
}

/**
 * Create entitlements from a subscription plan
 */
export function createPlanEntitlements(
  plan: string,
  grantedBy: string = "system"
): CompanyEntitlements {
  const planDefaults = PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.free

  const modules = {} as Record<ModuleKey, ModuleEntitlement | null>

  for (const moduleKey of planDefaults.modules) {
    modules[moduleKey] = {
      moduleKey,
      permissions: planDefaults.permissions,
      grantedAt: new Date(),
      grantedBy,
      reason: `Default for ${plan} plan`,
    }
  }

  return {
    version: 2,
    modules,
    subscriptionPlan: plan,
  }
}

/**
 * Check if a company has a specific permission
 */
export function hasPermission(
  entitlements: CompanyEntitlements | LegacyEntitlements | null | undefined,
  moduleKey: ModuleKey,
  action: PermissionAction
): boolean {
  if (!entitlements) return false

  // Handle legacy format - convert to boolean (all or nothing)
  if (Array.isArray(entitlements)) {
    return entitlements.includes(moduleKey)
  }

  // Handle v2 format
  if (!isV2Entitlements(entitlements)) return false

  const moduleEntitlement = entitlements.modules[moduleKey]
  if (!moduleEntitlement) return false

  // Check expiration
  if (moduleEntitlement.expiresAt && new Date(moduleEntitlement.expiresAt) < new Date()) {
    return false
  }

  return moduleEntitlement.permissions.includes(action)
}

/**
 * Check if a module is enabled (has any permissions)
 */
export function isModuleEnabled(
  entitlements: CompanyEntitlements | LegacyEntitlements | null | undefined,
  moduleKey: ModuleKey
): boolean {
  if (!entitlements) return false

  // Handle legacy format
  if (Array.isArray(entitlements)) {
    return entitlements.includes(moduleKey)
  }

  // Handle v2 format
  if (!isV2Entitlements(entitlements)) return false

  const moduleEntitlement = entitlements.modules[moduleKey]
  if (!moduleEntitlement) return false

  // Check expiration
  if (moduleEntitlement.expiresAt && new Date(moduleEntitlement.expiresAt) < new Date()) {
    return false
  }

  return moduleEntitlement.permissions.length > 0
}

/**
 * Get all permissions for a module
 */
export function getModulePermissions(
  entitlements: CompanyEntitlements | LegacyEntitlements | null | undefined,
  moduleKey: ModuleKey
): PermissionAction[] {
  if (!entitlements) return []

  // Handle legacy format - return default permissions if module is enabled
  if (Array.isArray(entitlements)) {
    return entitlements.includes(moduleKey) ? DEFAULT_MODULE_PERMISSIONS : []
  }

  // Handle v2 format
  if (!isV2Entitlements(entitlements)) return []

  const moduleEntitlement = entitlements.modules[moduleKey]
  if (!moduleEntitlement) return []

  // Check expiration
  if (moduleEntitlement.expiresAt && new Date(moduleEntitlement.expiresAt) < new Date()) {
    return []
  }

  return moduleEntitlement.permissions
}

/**
 * Grant a trial entitlement with expiration
 */
export function grantTrialEntitlement(
  entitlements: CompanyEntitlements,
  moduleKey: ModuleKey,
  trialDays: number,
  grantedBy: string
): CompanyEntitlements {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + trialDays)

  return {
    ...entitlements,
    modules: {
      ...entitlements.modules,
      [moduleKey]: {
        moduleKey,
        permissions: DEFAULT_MODULE_PERMISSIONS,
        expiresAt,
        grantedAt: new Date(),
        grantedBy,
        reason: `${trialDays}-day trial`,
      },
    },
  }
}

/**
 * Revoke a module entitlement
 */
export function revokeEntitlement(
  entitlements: CompanyEntitlements,
  moduleKey: ModuleKey
): CompanyEntitlements {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [moduleKey]: _removed, ...remainingModules } = entitlements.modules

  return {
    ...entitlements,
    modules: remainingModules as Record<ModuleKey, ModuleEntitlement | null>,
  }
}

/**
 * Update permissions for a module
 */
export function updateModulePermissions(
  entitlements: CompanyEntitlements,
  moduleKey: ModuleKey,
  permissions: PermissionAction[],
  updatedBy: string,
  reason?: string
): CompanyEntitlements {
  const existing = entitlements.modules[moduleKey]

  return {
    ...entitlements,
    modules: {
      ...entitlements.modules,
      [moduleKey]: {
        moduleKey,
        permissions,
        expiresAt: existing?.expiresAt ?? null,
        grantedAt: existing?.grantedAt ?? new Date(),
        grantedBy: updatedBy,
        reason: reason ?? existing?.reason,
      },
    },
  }
}
