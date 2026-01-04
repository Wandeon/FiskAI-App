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
import { parseTenantFlags, type TenantFeatureFlags } from "./config/features"

// Re-export from new capabilities module for Enterprise Hardening
// NOTE: resolveCapability/resolveCapabilities are server-only - import from
// "@/lib/capabilities/resolver" in server code to avoid bundling server deps
export {
  // Types
  type CapabilityState,
  type CapabilityInput,
  type CapabilityBlocker,
  type CapabilityAction,
  type CapabilityResponse,
  type CapabilityRequest,
  type CapabilityMetadata,
  // Registry
  CAPABILITY_REGISTRY,
  CAPABILITY_BY_ID,
  getCapabilityMetadata,
  getCapabilitiesByDomain,
  getCapabilitiesAffectingEntity,
} from "./capabilities/index"

export type LegalForm = "OBRT_PAUSAL" | "OBRT_REAL" | "OBRT_VAT" | "JDOO" | "DOO"
export type { ModuleKey, PermissionAction }

/**
 * Inferred user segment based on company attributes.
 * Used for quick categorization without database queries.
 */
export type InferredSegment =
  | "pausalni_non_vat"
  | "pausalni_vat"
  | "real_income"
  | "corporate_doo"
  | "corporate_jdoo"
  | "unknown"

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
  featureFlags: TenantFeatureFlags
  modules: Record<ModuleKey, ModuleCapability>
  /** Inferred user segment for quick targeting decisions */
  segment: InferredSegment
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
  "platform-core",
  "invoicing",
  "e-invoicing",
  "expenses",
  "banking",
  "reports-basic",
  "documents",
  "contacts",
  "products",
]

/**
 * Infer user segment from company attributes.
 * This is a fast, synchronous check that can be used without database queries.
 */
function inferSegment(legalForm: LegalForm, isVatPayer: boolean): InferredSegment {
  switch (legalForm) {
    case "OBRT_PAUSAL":
      return isVatPayer ? "pausalni_vat" : "pausalni_non_vat"
    case "OBRT_VAT":
      return "pausalni_vat"
    case "OBRT_REAL":
      return "real_income"
    case "DOO":
      return "corporate_doo"
    case "JDOO":
      return "corporate_jdoo"
    default:
      return "unknown"
  }
}

/**
 * Derive capabilities from company data.
 * Combines module entitlements with tenant-specific feature flags.
 *
 * @see /src/lib/config/features.ts for global feature configuration
 * @see /src/lib/modules/definitions.ts for module definitions
 * @see /src/lib/segmentation for full segment evaluation
 */
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

  // Use unified config parsing for tenant feature flags
  const featureFlags = parseTenantFlags(company?.featureFlags)
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
      permissions: enabled
        ? permissions.length > 0
          ? permissions
          : DEFAULT_MODULE_PERMISSIONS
        : [],
      expiresAt,
    }
  }

  const requireVatFields =
    isVatPayer || legalForm === "OBRT_VAT" || legalForm === "DOO" || legalForm === "JDOO"
  const allowReverseCharge = isVatPayer
  const requireOib = legalForm === "DOO" || legalForm === "JDOO"

  // Infer segment for quick targeting decisions
  const segment = inferSegment(legalForm, isVatPayer)

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
    segment,
    visibility: {
      requireVatFields,
      allowReverseCharge,
      requireOib,
    },
    can,
  }
}
