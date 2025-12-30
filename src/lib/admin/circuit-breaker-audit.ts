// src/lib/admin/circuit-breaker-audit.ts

/**
 * Audit logging and ops notification for circuit breaker resets
 *
 * Issue #835: Circuit breaker reset lacks audit logging and notification
 *
 * This module provides centralized audit logging and ops team notification
 * when administrators manually reset circuit breakers. This ensures:
 * - Persistent audit trail in database (not just console.log)
 * - Ops team notification via Slack/email/webhook for awareness
 */

import { logAuditEvent } from "@/lib/regulatory-truth/utils/audit-log"
import { sendSystemStatusAlerts } from "@/lib/system-status/alerting"
import type { SystemStatusEventInput } from "@/lib/system-status/diff"

interface CircuitBreakerResetParams {
  /** List of circuit breakers/domains that were reset */
  resetItems: string[]
  /** Admin email who performed the reset */
  adminEmail: string | null | undefined
  /** Admin user ID who performed the reset */
  adminId: string | null | undefined
  /** Optional reason provided by admin for the reset */
  reason?: string
  /** Component type: worker (opossum-based) or sentinel (rate limiter based) */
  component: "worker" | "sentinel"
  /** Whether a specific item was reset or all items */
  resetType: "specific" | "all"
}

/**
 * Log circuit breaker reset to audit trail and notify ops team
 */
export async function auditCircuitBreakerReset(
  params: CircuitBreakerResetParams
): Promise<void> {
  const { resetItems, adminEmail, adminId, reason, component, resetType } = params

  // Skip if nothing was reset
  if (resetItems.length === 0) {
    return
  }

  const componentLabel = component === "worker" ? "Worker" : "Sentinel"
  const itemLabel = component === "worker" ? "circuit breakers" : "domains"

  // 1. Log to database audit trail
  try {
    await logAuditEvent({
      action: "CIRCUIT_BREAKER_RESET",
      entityType: "SYSTEM",
      entityId: `circuit-breaker-${component}`,
      performedBy: adminId || adminEmail || "UNKNOWN_ADMIN",
      metadata: {
        component,
        resetType,
        resetItems,
        resetCount: resetItems.length,
        reason: reason || "No reason provided",
        adminEmail,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    // Log error but don't fail the reset operation
    console.error("[circuit-breaker-audit] Failed to log audit event:", error)
  }

  // 2. Send ops team notification
  try {
    const message =
      resetType === "specific"
        ? `${componentLabel} circuit breaker manually reset: ${resetItems.join(", ")}`
        : `All ${componentLabel} ${itemLabel} manually reset (${resetItems.length} total): ${resetItems.join(", ")}`

    const alertEvent: SystemStatusEventInput = {
      eventType: "CIRCUIT_BREAKER_RESET" as const,
      severity: "WARNING",
      message,
      nextAction: reason
        ? `Admin provided reason: ${reason}`
        : "Monitor for recurrence. If circuit breaker trips again, investigate root cause.",
      componentId: `${component}-circuit-breaker`,
      owner: adminEmail || undefined,
    }

    await sendSystemStatusAlerts([alertEvent])
  } catch (error) {
    // Log error but don't fail the reset operation
    console.error("[circuit-breaker-audit] Failed to send ops notification:", error)
  }
}
