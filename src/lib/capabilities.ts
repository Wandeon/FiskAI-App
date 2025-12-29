import type { Company } from "@prisma/client"
import { MODULE_KEYS, ModuleKey } from "./modules/definitions"
import {
  type PermissionAction,
  type CompanyEntitlements,
  type LegacyEntitlements,
  isV2Entitlements,
  isModuleEnabled,
  getModulePermissions,
  hasPermission,
  DEFAULT_MODULE_PERMISSIONS,
} from "./modules/permissions"

export type LegalForm = "OBRT_PAUSAL" | "OBRT_REAL" | "OBRT_VAT" | "JDOO" | "DOO"
export type { ModuleKey, PermissionAction }

export interface ModuleCapability {
  enabled: boolean
  reason?: string
  permissions: PermissionAction[]
  expiresAt?: Date | null
}

export interface Capabilities {
  legalForm: LegalForm
  isVatPayer: boolean
  entitlements: ModuleKey[]
  featureFlags: Record<string, boolean>
  modules: Record<ModuleKey, ModuleCapability>
  visibility: {
    requireVatFields: boolean
    allowReverseCharge: boolean
    requireOib: boolean
  }
  /** Check if company has specific permission for a module */
  can: (moduleKey: ModuleKey, action: PermissionAction) => boolean
}

// Partial company type for deriveCapabilities - only needs fields we actually use
type PartialCompany = Pick<Company, "isVatPayer"> & {
  legalForm?: string | null
  entitlements?: unknown
  featureFlags?: unknown
}

const defaultEntitlements: ModuleKey[] = [
  "invoicing",
  "e-invoicing",
  "expenses",
  "banking",
  "reports-basic",
  "documents",
  "contacts",
  "products",
]

export function deriveCapabilities(company: PartialCompany | null): Capabilities {
  const legalForm = (company?.legalForm as LegalForm) || "DOO"

  // Handle Prisma's Json type safely - supports both legacy array and v2 format
  const rawEntitlements = company?.entitlements as
    | CompanyEntitlements
    | LegacyEntitlements
    | null
    | undefined

  // Derive enabled modules list for backwards compatibility
  let entitlements: ModuleKey[] = defaultEntitlements
  if (Array.isArray(rawEntitlements)) {
    entitlements = rawEntitlements as ModuleKey[]
  } else if (isV2Entitlements(rawEntitlements)) {
    entitlements = MODULE_KEYS.filter((key) => isModuleEnabled(rawEntitlements, key))
  }

  const featureFlags = (company?.featureFlags as Record<string, boolean>) || {}
  const isVatPayer = !!company?.isVatPayer

  // Create capability map for all known modules with granular permissions
  const modules = {} as Record<ModuleKey, ModuleCapability>
  for (const key of MODULE_KEYS) {
    const enabled = isModuleEnabled(rawEntitlements, key) || entitlements.includes(key)
    const permissions = getModulePermissions(rawEntitlements, key)

    // Get expiration from v2 entitlements
    let expiresAt: Date | null = null
    if (isV2Entitlements(rawEntitlements) && rawEntitlements.modules[key]?.expiresAt) {
      expiresAt = new Date(rawEntitlements.modules[key]!.expiresAt!)
    }

    modules[key] = {
      enabled,
      permissions: enabled ? (permissions.length > 0 ? permissions : DEFAULT_MODULE_PERMISSIONS) : [],
      expiresAt,
    }
  }

  const requireVatFields =
    isVatPayer || legalForm === "OBRT_VAT" || legalForm === "DOO" || legalForm === "JDOO"
  const allowReverseCharge = isVatPayer
  const requireOib = legalForm === "DOO" || legalForm === "JDOO"

  // Create the can() helper function
  const can = (moduleKey: ModuleKey, action: PermissionAction): boolean => {
    return hasPermission(rawEntitlements, moduleKey, action)
  }

  return {
    legalForm,
    isVatPayer,
    entitlements,
    featureFlags,
    modules,
    visibility: {
      requireVatFields,
      allowReverseCharge,
      requireOib,
    },
    can,
  }
}
