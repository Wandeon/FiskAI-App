import type { Company } from "@prisma/client"
import { MODULE_KEYS, ModuleKey } from "./modules/definitions"
import { parseTenantFlags, type TenantFeatureFlags } from "./config/features"

export type LegalForm = "OBRT_PAUSAL" | "OBRT_REAL" | "OBRT_VAT" | "JDOO" | "DOO"
export type { ModuleKey }

export interface Capabilities {
  legalForm: LegalForm
  isVatPayer: boolean
  entitlements: ModuleKey[]
  featureFlags: TenantFeatureFlags
  modules: Record<ModuleKey, { enabled: boolean; reason?: string }>
  visibility: {
    requireVatFields: boolean
    allowReverseCharge: boolean
    requireOib: boolean
  }
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

/**
 * Derive capabilities from company data.
 * Combines module entitlements with tenant-specific feature flags.
 *
 * @see /src/lib/config/features.ts for global feature configuration
 * @see /src/lib/modules/definitions.ts for module definitions
 */
export function deriveCapabilities(company: PartialCompany | null): Capabilities {
  const legalForm = (company?.legalForm as LegalForm) || "DOO"

  // Handle Prisma's Json type safely
  let entitlements = defaultEntitlements
  if (Array.isArray(company?.entitlements)) {
    entitlements = company.entitlements as ModuleKey[]
  }

  // Use unified config parsing for tenant feature flags
  const featureFlags = parseTenantFlags(company?.featureFlags)
  const isVatPayer = !!company?.isVatPayer

  // Create visibility map for all known modules
  const modules = {} as Record<ModuleKey, { enabled: boolean; reason?: string }>
  for (const key of MODULE_KEYS) {
    modules[key] = { enabled: entitlements.includes(key) }
  }

  const requireVatFields =
    isVatPayer || legalForm === "OBRT_VAT" || legalForm === "DOO" || legalForm === "JDOO"
  const allowReverseCharge = isVatPayer
  const requireOib = legalForm === "DOO" || legalForm === "JDOO"

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
  }
}
