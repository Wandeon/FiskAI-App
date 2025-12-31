// src/lib/admin/circuit-breaker-audit.ts
import { logAuditEvent } from "@/lib/regulatory-truth/utils/audit-log"
import { sendSystemStatusAlerts } from "@/lib/system-status/alerting"
import type { SystemStatusEventInput } from "@/lib/system-status/diff"

interface CircuitBreakerResetParams {
  resetItems: string[]
  adminEmail: string | null | undefined
  adminId: string | null | undefined
  reason?: string
  component: "worker" | "sentinel"
  resetType: "specific" | "all"
}

export async function auditCircuitBreakerReset(params: CircuitBreakerResetParams): Promise<void> {
  const { resetItems, adminEmail, adminId, reason, component, resetType } = params
  if (resetItems.length === 0) return

  const componentLabel = component === "worker" ? "Worker" : "Sentinel"
  const itemLabel = component === "worker" ? "circuit breakers" : "domains"

  try {
    await logAuditEvent({
      action: "CIRCUIT_BREAKER_RESET",
      entityType: "SYSTEM",
      entityId: "circuit-breaker-" + component,
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
    console.error("[circuit-breaker-audit] Failed to log audit event:", error)
  }

  try {
    const message =
      resetType === "specific"
        ? componentLabel + " circuit breaker manually reset: " + resetItems.join(", ")
        : "All " +
          componentLabel +
          " " +
          itemLabel +
          " manually reset (" +
          resetItems.length +
          " total): " +
          resetItems.join(", ")

    const alertEvent: SystemStatusEventInput = {
      eventType: "CIRCUIT_BREAKER_RESET" as const,
      severity: "WARNING",
      message,
      nextAction: reason ? "Admin provided reason: " + reason : "Monitor for recurrence.",
      componentId: component + "-circuit-breaker",
      owner: adminEmail || undefined,
    }
    await sendSystemStatusAlerts([alertEvent])
  } catch (error) {
    console.error("[circuit-breaker-audit] Failed to send ops notification:", error)
  }
}
