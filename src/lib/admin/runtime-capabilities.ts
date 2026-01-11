// src/lib/admin/runtime-capabilities.ts
/**
 * Runtime Capability Detection - Thin Wrapper
 *
 * This module provides a simplified API for admin pages to check if features
 * are configured (tables exist). It delegates to feature-contracts.ts which
 * is the single source of truth for table requirements.
 *
 * DO NOT add table names here - all table definitions live in feature-contracts.ts.
 */

import "server-only"
import { getFeatureStatus, FEATURES, type FeatureId } from "./feature-contracts"

/**
 * Capability check result for admin pages.
 */
export interface CapabilityResult {
  /** All required tables exist */
  available: boolean
  /** List of missing tables */
  missingTables: string[]
  /** List of all required tables (for action hints) */
  requiredTables: readonly string[]
}

/**
 * Check if News feature tables are available.
 *
 * Delegates to feature-contracts.ts for the actual table list.
 */
export async function hasNewsTables(): Promise<CapabilityResult> {
  const status = await getFeatureStatus("news")
  return {
    available: status.configured,
    missingTables: status.missingTables,
    requiredTables: status.requiredTables,
  }
}

/**
 * Check if Content Automation (Regulatory Truth) tables are available.
 *
 * Delegates to feature-contracts.ts for the actual table list.
 */
export async function hasRegulatoryTruthTables(): Promise<CapabilityResult> {
  const status = await getFeatureStatus("contentAutomation")
  return {
    available: status.configured,
    missingTables: status.missingTables,
    requiredTables: status.requiredTables,
  }
}

/**
 * Generic capability check for any feature.
 *
 * Use this when you need capability info for a specific feature.
 */
export async function hasFeatureTables(featureId: FeatureId): Promise<CapabilityResult> {
  const status = await getFeatureStatus(featureId)
  return {
    available: status.configured,
    missingTables: status.missingTables,
    requiredTables: status.requiredTables,
  }
}

// ============================================================================
// DEPRECATED: Table constants
// These are kept for backward compatibility but should not be used.
// Import FEATURES from feature-contracts.ts instead.
// ============================================================================

/**
 * @deprecated Use FEATURES.news.requiredTables from feature-contracts.ts
 */
export const NEWS_TABLES = FEATURES.news.requiredTables

/**
 * @deprecated Use FEATURES.contentAutomation.requiredTables from feature-contracts.ts
 */
export const CONTENT_AUTOMATION_TABLES = FEATURES.contentAutomation.requiredTables
