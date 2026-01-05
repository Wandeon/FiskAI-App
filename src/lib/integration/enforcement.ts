/**
 * Phase 5: Enforcement Module
 *
 * This module provides runtime enforcement of IntegrationAccount usage.
 *
 * **Three modes:**
 * 1. `OFF` - Legacy paths work normally (no flags set)
 * 2. `SHADOW` - Legacy paths work but emit "would-have-blocked" logs
 *    (FF_LOG_LEGACY_PATH_USAGE=true, FF_ENFORCE_INTEGRATION_ACCOUNT=false)
 * 3. `ENFORCE` - Legacy paths throw IntegrationRequiredError
 *    (FF_ENFORCE_INTEGRATION_ACCOUNT=true)
 *
 * **Shadow mode log format:**
 * ```json
 * {
 *   "level": "warn",
 *   "msg": "integration.legacy_path.would_block",
 *   "operation": "FISCALIZATION|EINVOICE_SEND|EINVOICE_RECEIVE|WORKER_JOB",
 *   "companyId": "cmp_xxx",
 *   "path": "legacy",
 *   "integrationAccountId": null,
 *   "reason": "...",
 *   "shadowMode": true
 * }
 * ```
 *
 * @module integration/enforcement
 * @since Phase 5 - Enforcement & Cleanup
 */

import { isFeatureEnabled } from "@/lib/integration-feature-flags"
import { logger } from "@/lib/logger"

/** Operation types that require IntegrationAccount */
export type EnforcedOperation =
  | "FISCALIZATION"
  | "EINVOICE_SEND"
  | "EINVOICE_RECEIVE"
  | "WORKER_JOB"

/** Structured log fields for enforcement events */
export interface EnforcementLogContext {
  operation: EnforcedOperation
  companyId: string
  path: "legacy" | "v2"
  integrationAccountId: string | null
  reason: string
  shadowMode: boolean
  [key: string]: unknown
}

/**
 * P0 Severity Error - Integration Required
 *
 * Thrown when enforcement is enabled and code attempts to execute
 * a regulated operation without an IntegrationAccount.
 *
 * This error indicates:
 * - A code path that should have been migrated but wasn't
 * - A potential security/compliance issue
 * - Must never be retried silently
 *
 * When this error is thrown:
 * 1. Log at ERROR level with full context
 * 2. Alert operations (P0 incident)
 * 3. Fail fast, do not retry
 */
export class IntegrationRequiredError extends Error {
  /** P0 severity - critical enforcement failure */
  public readonly severity = "P0" as const

  /** Operation that was attempted */
  public readonly operation: string

  /** Company that attempted the operation */
  public readonly companyId: string

  /** Why this failed (what was missing) */
  public readonly reason: string

  constructor(
    operation: "FISCALIZATION" | "EINVOICE_SEND" | "EINVOICE_RECEIVE" | "WORKER_JOB",
    companyId: string,
    reason: string
  ) {
    super(
      `IntegrationAccount required for ${operation}. ` +
        `Company: ${companyId}. Reason: ${reason}. ` +
        `Legacy paths are disabled (FF_ENFORCE_INTEGRATION_ACCOUNT=true).`
    )
    this.name = "IntegrationRequiredError"
    this.operation = operation
    this.companyId = companyId
    this.reason = reason
  }
}

/**
 * Emits a structured log for legacy path usage (shadow mode).
 *
 * This is called when shadow mode is active to track operations
 * that WOULD have been blocked if enforcement was enabled.
 *
 * @param operation - The operation type
 * @param companyId - The company ID
 * @param context - Additional context
 */
function emitShadowModeLog(
  operation: EnforcedOperation,
  companyId: string,
  context: Record<string, unknown> = {}
): void {
  const logContext: EnforcementLogContext = {
    operation,
    companyId,
    path: "legacy",
    integrationAccountId: null,
    reason: "No integrationAccountId provided",
    shadowMode: true,
    ...context,
  }

  logger.warn(logContext, "integration.legacy_path.would_block")
}

/**
 * Asserts that enforcement is not blocking a legacy path.
 *
 * **Behavior by mode:**
 * - `OFF` (no flags): Returns immediately, no logging
 * - `SHADOW` (LOG_LEGACY_PATH_USAGE=true): Logs warning, returns
 * - `ENFORCE` (ENFORCE_INTEGRATION_ACCOUNT=true): Throws IntegrationRequiredError
 *
 * Call this at the START of any legacy code path.
 *
 * @param operation - The operation type being attempted
 * @param companyId - The company attempting the operation
 * @param context - Additional context for logging
 * @throws IntegrationRequiredError if enforcement is enabled
 */
export function assertLegacyPathAllowed(
  operation: EnforcedOperation,
  companyId: string,
  context: Record<string, unknown> = {}
): void {
  // Mode 3: ENFORCE - throw error
  if (isFeatureEnabled("ENFORCE_INTEGRATION_ACCOUNT")) {
    const logContext: EnforcementLogContext = {
      operation,
      companyId,
      path: "legacy",
      integrationAccountId: null,
      reason: "No integrationAccountId provided and legacy paths are disabled",
      shadowMode: false,
      ...context,
    }

    logger.error(logContext, "integration.legacy_path.blocked")

    throw new IntegrationRequiredError(
      operation,
      companyId,
      `No integrationAccountId provided and legacy paths are disabled`
    )
  }

  // Mode 2: SHADOW - log warning but allow operation
  if (isFeatureEnabled("LOG_LEGACY_PATH_USAGE")) {
    emitShadowModeLog(operation, companyId, context)
  }

  // Mode 1: OFF - silent pass-through
}

/**
 * Asserts that a worker job has required integration context.
 *
 * **Behavior by mode:**
 * - `OFF`: Returns immediately if integrationAccountId present
 * - `SHADOW`: Logs warning if missing, returns
 * - `ENFORCE`: Throws IntegrationRequiredError if missing
 *
 * @param companyId - Company ID from job
 * @param integrationAccountId - IntegrationAccount ID from job
 * @param workerName - Name of the worker for logging
 * @throws IntegrationRequiredError if enforcement enabled and integrationAccountId missing
 */
export function assertWorkerHasIntegration(
  companyId: string,
  integrationAccountId: string | null | undefined,
  workerName: string
): void {
  // If we have an integrationAccountId, always pass
  if (integrationAccountId) {
    return
  }

  // Mode 3: ENFORCE - throw error
  if (isFeatureEnabled("ENFORCE_INTEGRATION_ACCOUNT")) {
    const logContext: EnforcementLogContext = {
      operation: "WORKER_JOB",
      companyId,
      path: "legacy",
      integrationAccountId: null,
      reason: `Worker ${workerName} requires integrationAccountId`,
      shadowMode: false,
      workerName,
    }

    logger.error(logContext, "integration.legacy_path.blocked")

    throw new IntegrationRequiredError(
      "WORKER_JOB",
      companyId,
      `Worker ${workerName} requires integrationAccountId`
    )
  }

  // Mode 2: SHADOW - log warning but allow operation
  if (isFeatureEnabled("LOG_LEGACY_PATH_USAGE")) {
    emitShadowModeLog("WORKER_JOB", companyId, { workerName })
  }

  // Mode 1: OFF - silent pass-through
}

/**
 * Check if enforcement mode is active.
 * Useful for logging/metrics without throwing.
 */
export function isEnforcementActive(): boolean {
  return isFeatureEnabled("ENFORCE_INTEGRATION_ACCOUNT")
}

/**
 * Check if shadow mode is active (logging but not blocking).
 */
export function isShadowModeActive(): boolean {
  return (
    !isFeatureEnabled("ENFORCE_INTEGRATION_ACCOUNT") && isFeatureEnabled("LOG_LEGACY_PATH_USAGE")
  )
}

/**
 * Get current enforcement mode.
 */
export function getEnforcementMode(): "OFF" | "SHADOW" | "ENFORCE" {
  if (isFeatureEnabled("ENFORCE_INTEGRATION_ACCOUNT")) {
    return "ENFORCE"
  }
  if (isFeatureEnabled("LOG_LEGACY_PATH_USAGE")) {
    return "SHADOW"
  }
  return "OFF"
}
