// src/lib/admin/feature-contracts.ts
/**
 * Feature Contract Registry - Single Source of Truth
 *
 * This is the ONLY place where feature-to-table mappings are defined.
 * All capability checks, health probes, and CI scripts must import from here.
 *
 * Type A: Contracted - tables must exist in production, missing = deployment defect
 * Type B: Optional - graceful degradation allowed, render "Not configured" UI
 *
 * DO NOT duplicate table lists anywhere else. If you need to check a feature's
 * tables, import from this module.
 */

import { drizzleDb } from "@/lib/db/drizzle"
import { sql } from "drizzle-orm"
import { logger } from "@/lib/logger"

const featureLogger = logger.child({ context: "feature-contracts" })

/**
 * Feature type determines enforcement behavior:
 * - Type A: Missing tables = deployment failure, blocks readiness in prod
 * - Type B: Missing tables = graceful degradation, UI shows "Not configured"
 */
export type FeatureType = "A" | "B"

export interface FeatureDefinition {
  name: string
  description: string
  requiredTables: readonly string[]
  type: FeatureType
  envFlag: string // Environment variable to control enforcement
}

/**
 * CANONICAL FEATURE REGISTRY
 *
 * This is the single source of truth for all feature-to-table mappings.
 * When adding a new feature:
 * 1. Add it here with the appropriate type
 * 2. Type A features block readiness when tables are missing (prod only)
 * 3. Type B features show "Not configured" UI when tables are missing
 */
export const FEATURES = {
  news: {
    name: "News",
    description: "News and content publishing system",
    requiredTables: ["news_posts", "news_categories", "news_items", "news_sources"],
    type: "A" as FeatureType,
    envFlag: "NEWS_TYPE_A",
  },
  contentAutomation: {
    name: "Content Automation",
    description: "Regulatory content processing and publishing pipeline",
    requiredTables: ["ArticleJob", "content_sync_events"],
    type: "B" as FeatureType,
    envFlag: "CONTENT_AUTOMATION_TYPE_A", // Can be promoted to Type A later
  },
} as const satisfies Record<string, FeatureDefinition>

export type FeatureId = keyof typeof FEATURES

/**
 * Result of checking a feature's status.
 */
export interface FeatureStatus {
  /** Feature identifier */
  featureId: FeatureId
  /** Human-readable name */
  name: string
  /** All required tables exist in the database */
  configured: boolean
  /** Type A enforcement is active (missing tables = deployment defect) */
  enforced: boolean
  /** List of tables that are missing */
  missingTables: string[]
  /** List of all required tables for this feature */
  requiredTables: readonly string[]
  /** Feature type (A = contracted, B = optional) */
  type: FeatureType
}

/**
 * Check if a table exists in the public schema.
 *
 * NOTE: This explicitly checks only the 'public' schema. If your tables
 * are in a different schema, this check will report them as missing.
 */
async function tableExists(tableName: string): Promise<boolean> {
  const result = await drizzleDb.execute(
    sql`SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ) as exists`
  )
  return result.rows[0]?.exists === true
}

/**
 * Check if Type A enforcement is enabled for a feature.
 *
 * Defaults:
 * - Production: enabled (Type A features are enforced unless explicitly disabled)
 * - Development: disabled (opt-in enforcement via env flag)
 */
function isEnforcementEnabled(feature: FeatureDefinition): boolean {
  const envValue = process.env[feature.envFlag]

  // Explicit disable takes precedence
  if (envValue === "false" || envValue === "0") {
    return false
  }

  // Type B features are never enforced unless explicitly promoted
  if (feature.type === "B") {
    return envValue === "true" || envValue === "1"
  }

  // Type A in production: default to enforced
  if (process.env.NODE_ENV === "production") {
    return true
  }

  // Type A in development: opt-in
  return envValue === "true" || envValue === "1"
}

/**
 * Get the complete status of a feature.
 *
 * This is the primary API for checking feature availability. Use this
 * instead of directly checking tables or hardcoding table names.
 *
 * @example
 * const status = await getFeatureStatus("news")
 * if (!status.configured) {
 *   return <NotConfigured feature={status.name} missingTables={status.missingTables} />
 * }
 */
export async function getFeatureStatus(featureId: FeatureId): Promise<FeatureStatus> {
  const feature = FEATURES[featureId]
  const enforced = isEnforcementEnabled(feature)

  const missingTables: string[] = []
  for (const table of feature.requiredTables) {
    if (!(await tableExists(table))) {
      missingTables.push(table)
    }
  }

  const configured = missingTables.length === 0

  // Log CRITICAL error for missing Type A tables in production
  if (!configured && enforced && process.env.NODE_ENV === "production") {
    featureLogger.error(
      {
        featureId,
        featureName: feature.name,
        missingTables,
        severity: "CRITICAL",
        schema: "public",
      },
      `[TYPE A CONTRACT VIOLATION] Feature "${feature.name}" is missing required tables in public schema: ${missingTables.join(", ")}. ` +
        "This is a deployment defect. Run migrations to fix."
    )
  }

  return {
    featureId,
    name: feature.name,
    configured,
    enforced,
    missingTables,
    requiredTables: feature.requiredTables,
    type: feature.type,
  }
}

/**
 * Get status of all features.
 *
 * Useful for health checks and dashboards that need to report on all features.
 */
export async function getAllFeatureStatuses(): Promise<{
  allConfigured: boolean
  allEnforcedHealthy: boolean
  features: FeatureStatus[]
}> {
  const features: FeatureStatus[] = []
  let allConfigured = true
  let allEnforcedHealthy = true

  for (const featureId of Object.keys(FEATURES) as FeatureId[]) {
    const status = await getFeatureStatus(featureId)
    features.push(status)

    if (!status.configured) {
      allConfigured = false
    }

    if (status.enforced && !status.configured) {
      allEnforcedHealthy = false
    }
  }

  return { allConfigured, allEnforcedHealthy, features }
}

// ============================================================================
// BACKWARD COMPATIBILITY API
// These functions maintain the existing API shape for the health check.
// They delegate to the new unified API.
// ============================================================================

/**
 * @deprecated Use getFeatureStatus() instead
 * Kept for backward compatibility with existing health check code.
 */
export interface FeatureContractResult {
  featureId: FeatureId
  name: string
  enabled: boolean
  healthy: boolean
  missingTables: string[]
}

/**
 * @deprecated Use getFeatureStatus() instead
 */
export async function verifyFeatureContract(featureId: FeatureId): Promise<FeatureContractResult> {
  const status = await getFeatureStatus(featureId)
  return {
    featureId: status.featureId,
    name: status.name,
    enabled: status.enforced,
    healthy: status.configured,
    missingTables: [...status.missingTables],
  }
}

/**
 * @deprecated Use getAllFeatureStatuses() instead
 */
export async function verifyAllFeatureContracts(): Promise<{
  allHealthy: boolean
  features: FeatureContractResult[]
}> {
  const { allEnforcedHealthy, features } = await getAllFeatureStatuses()
  return {
    allHealthy: allEnforcedHealthy,
    features: features.map((status) => ({
      featureId: status.featureId,
      name: status.name,
      enabled: status.enforced,
      healthy: status.configured,
      missingTables: [...status.missingTables],
    })),
  }
}

/**
 * Run Type A contract verification at startup.
 *
 * Call this during application initialization to detect deployment defects early.
 * In production, missing Type A tables will log CRITICAL errors.
 */
export async function runStartupContractVerification(): Promise<void> {
  featureLogger.info("Running feature contract verification...")

  try {
    const { allEnforcedHealthy, features } = await getAllFeatureStatuses()

    const enforcedFeatures = features.filter((f) => f.enforced)
    const unhealthyFeatures = enforcedFeatures.filter((f) => !f.configured)

    if (enforcedFeatures.length === 0) {
      featureLogger.info("No Type A features enforced in this environment")
      return
    }

    if (allEnforcedHealthy) {
      featureLogger.info(
        { features: enforcedFeatures.map((f) => f.name) },
        `All enforced feature contracts satisfied: ${enforcedFeatures.map((f) => f.name).join(", ")}`
      )
    } else {
      // Individual CRITICAL logs already emitted by getFeatureStatus
      featureLogger.error(
        {
          unhealthyFeatures: unhealthyFeatures.map((f) => ({
            name: f.name,
            missingTables: f.missingTables,
          })),
          severity: "CRITICAL",
        },
        `Feature contract verification FAILED: ${unhealthyFeatures.length} feature(s) have missing tables`
      )
    }
  } catch (error) {
    featureLogger.error(
      { error, severity: "CRITICAL" },
      "Failed to run feature contract verification - database may be unavailable"
    )
  }
}

// ============================================================================
// TYPE A FEATURES CONSTANT (for CI script and legacy compatibility)
// ============================================================================

/**
 * @deprecated Import FEATURES directly and filter by type
 * Kept for backward compatibility with scripts that expect this shape.
 */
export const TYPE_A_FEATURES = Object.fromEntries(
  Object.entries(FEATURES)
    .filter(([, def]) => def.type === "A")
    .map(([key, def]) => [
      key,
      {
        name: def.name,
        description: def.description,
        requiredTables: def.requiredTables,
        envFlag: def.envFlag,
      },
    ])
) as Record<
  string,
  {
    name: string
    description: string
    requiredTables: readonly string[]
    envFlag: string
  }
>
