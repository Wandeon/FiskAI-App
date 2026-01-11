// src/lib/health/alerting.ts
/**
 * Health Check Alerting
 *
 * Emits alerts for health check failures using the existing system-status
 * alerting infrastructure. Includes throttling to prevent alert spam.
 *
 * Alert channels are configured via environment variables:
 * - SLACK_WEBHOOK_URL: Slack notifications
 * - SYSTEM_STATUS_WEBHOOK_URL: External monitoring webhooks
 * - ADMIN_ALERT_EMAIL + RESEND_API_KEY: Email alerts
 */

import { sendSystemStatusAlerts } from "@/lib/system-status/alerting"
import type { SystemStatusEventInput } from "@/lib/system-status/diff"
import { logger } from "@/lib/logger"

const alertLogger = logger.child({ context: "health-alerting" })

/**
 * Throttle state for contract failure alerts.
 *
 * DEPLOYMENT NOTE: This is in-memory, single-instance safe only.
 * Current deployment: Single Hetzner ARM64 server (152.53.146.3).
 *
 * If you scale to multiple instances, you MUST switch to shared storage:
 * - Redis: SET contract_failure_alert_last with EX 900 (15 min TTL)
 * - Database: Simple timestamp row with upsert
 *
 * Without shared storage, each instance will alert independently every 15 min.
 */
const contractFailureThrottle = {
  lastAlertTime: 0,
  cooldownMs: 15 * 60 * 1000, // 15 minutes
}

interface FailingFeature {
  featureId: string
  name: string
  missingTables: string[]
}

/**
 * Emit a CRITICAL alert for Type A contract failure.
 *
 * Throttled to prevent alert spam during repeated health check polls.
 * Uses existing system-status alerting infrastructure.
 *
 * @param failingFeatures - Features with missing tables
 * @param version - Current app version/commit SHA
 * @returns true if alert was sent, false if throttled or failed
 */
export async function emitContractFailureAlert(
  failingFeatures: FailingFeature[],
  version: string
): Promise<boolean> {
  const now = Date.now()

  // Check throttle - don't spam alerts
  if (now - contractFailureThrottle.lastAlertTime < contractFailureThrottle.cooldownMs) {
    alertLogger.debug(
      { lastAlert: new Date(contractFailureThrottle.lastAlertTime).toISOString() },
      "Contract failure alert throttled"
    )
    return false
  }

  // Build alert payload
  const featureNames = failingFeatures.map((f) => f.name).join(", ")
  const allMissingTables = failingFeatures.flatMap((f) => f.missingTables)
  const env = process.env.NODE_ENV || "development"

  const event: SystemStatusEventInput = {
    eventType: "NEW_CRITICAL",
    severity: "CRITICAL",
    message:
      `[${env.toUpperCase()}] Type A feature contract violation: ${featureNames} missing required tables.\n\n` +
      `Missing tables: ${allMissingTables.join(", ")}\n` +
      `Version: ${version}`,
    nextAction: "Run database migrations immediately: npm run prisma:migrate && npm run db:migrate",
    componentId: "health/readiness",
    owner: "platform",
    link: "/admin/system-status",
  }

  try {
    const result = await sendSystemStatusAlerts([event])

    if (result.sent > 0) {
      contractFailureThrottle.lastAlertTime = now
      alertLogger.info(
        {
          failingFeatures: failingFeatures.map((f) => f.featureId),
          missingTables: allMissingTables,
          alertsSent: result.sent,
        },
        "Contract failure alert sent"
      )
      return true
    } else {
      alertLogger.warn(
        { result },
        "Contract failure alert not sent (no channels configured or all failed)"
      )
      return false
    }
  } catch (error) {
    alertLogger.error({ error }, "Failed to send contract failure alert")
    return false
  }
}

/**
 * Reset throttle state (for testing)
 */
export function resetContractFailureThrottle(): void {
  contractFailureThrottle.lastAlertTime = 0
}

/**
 * Get current throttle state (for testing/debugging)
 */
export function getContractFailureThrottleState(): {
  lastAlertTime: number
  cooldownMs: number
  isThrottled: boolean
} {
  return {
    lastAlertTime: contractFailureThrottle.lastAlertTime,
    cooldownMs: contractFailureThrottle.cooldownMs,
    isThrottled:
      Date.now() - contractFailureThrottle.lastAlertTime < contractFailureThrottle.cooldownMs,
  }
}
