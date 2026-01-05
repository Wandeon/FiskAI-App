/**
 * Phase 5: Enforcement Module
 *
 * This module provides runtime enforcement of IntegrationAccount usage.
 * When FF_ENFORCE_INTEGRATION_ACCOUNT=true, all legacy paths MUST fail.
 *
 * @module integration/enforcement
 * @since Phase 5 - Enforcement & Cleanup
 */

import { isFeatureEnabled } from "@/lib/integration-feature-flags"
import { logger } from "@/lib/logger"

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
 * Asserts that enforcement is not blocking a legacy path.
 *
 * Call this at the START of any legacy code path. If enforcement
 * is enabled, this will throw IntegrationRequiredError immediately.
 *
 * @param operation - The operation type being attempted
 * @param companyId - The company attempting the operation
 * @param context - Additional context for logging
 * @throws IntegrationRequiredError if enforcement is enabled
 */
export function assertLegacyPathAllowed(
  operation: "FISCALIZATION" | "EINVOICE_SEND" | "EINVOICE_RECEIVE" | "WORKER_JOB",
  companyId: string,
  context: Record<string, unknown> = {}
): void {
  if (isFeatureEnabled("ENFORCE_INTEGRATION_ACCOUNT")) {
    logger.error(
      {
        operation,
        companyId,
        enforcement: true,
        ...context,
      },
      `P0: Legacy ${operation} path blocked - IntegrationAccount required`
    )

    throw new IntegrationRequiredError(
      operation,
      companyId,
      `No integrationAccountId provided and legacy paths are disabled`
    )
  }
}

/**
 * Asserts that a worker job has required integration context.
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
  if (!integrationAccountId && isFeatureEnabled("ENFORCE_INTEGRATION_ACCOUNT")) {
    logger.error(
      {
        companyId,
        workerName,
        enforcement: true,
      },
      `P0: Worker ${workerName} blocked - missing integrationAccountId`
    )

    throw new IntegrationRequiredError(
      "WORKER_JOB",
      companyId,
      `Worker ${workerName} requires integrationAccountId`
    )
  }
}

/**
 * Check if enforcement mode is active.
 * Useful for logging/metrics without throwing.
 */
export function isEnforcementActive(): boolean {
  return isFeatureEnabled("ENFORCE_INTEGRATION_ACCOUNT")
}
