// src/lib/regulatory-truth/watchdog/alerting.ts

import { db } from "@/lib/db"
import type { AlertPayload, AuditReport } from "./types"
import { sendCriticalAlert as sendSlackCritical, sendAuditResult as sendSlackAudit } from "./slack"
import { sendCriticalEmail, sendDailyDigest } from "./email"
import { sendCriticalAlertResend } from "./resend-email"

// Alert deduplication window in minutes (configurable via env, default 60)
const DEDUP_WINDOW_MINUTES = parseInt(process.env.ALERT_DEDUP_WINDOW_MINUTES || "60", 10)

/**
 * Raise an alert - handles deduplication, storage, and routing
 */
export async function raiseAlert(payload: AlertPayload): Promise<string> {
  const { severity, type, entityId, message, details } = payload

  // Check for duplicate in dedup window (default: 60 minutes)
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000)
  const existing = await db.watchdogAlert.findFirst({
    where: {
      type,
      entityId: entityId ?? undefined,
      occurredAt: { gte: cutoff },
      resolvedAt: null,
    },
    orderBy: { occurredAt: "desc" },
  })

  if (existing) {
    // Increment occurrence count instead of creating new
    await db.watchdogAlert.update({
      where: { id: existing.id },
      data: { occurrenceCount: { increment: 1 } },
    })
    console.log(
      `[alerting] Deduplicated alert ${type} for ${entityId} (count: ${existing.occurrenceCount + 1})`
    )
    return existing.id
  }

  // Create new alert
  const alert = await db.watchdogAlert.create({
    data: {
      severity,
      type,
      entityId,
      message,
      details: details ?? undefined,
    },
  })

  console.log(`[alerting] Created ${severity} alert: ${type} - ${message}`)

  // Route based on severity
  if (severity === "CRITICAL") {
    // Send via all channels: Slack, SMTP (legacy), and Resend (primary)
    await Promise.all([
      sendSlackCritical(type, message, details),
      sendCriticalEmail(alert), // Legacy SMTP
      sendCriticalAlertResend(alert), // Primary Resend
    ])
    await db.watchdogAlert.update({
      where: { id: alert.id },
      data: { notifiedAt: new Date() },
    })
  }

  return alert.id
}

/**
 * Send audit result notifications
 */
export async function notifyAuditResult(report: AuditReport): Promise<void> {
  // Always send to Slack
  await sendSlackAudit(report)

  // If failed, also raise an alert
  if (report.result === "FAIL") {
    await raiseAlert({
      severity: "CRITICAL",
      type: "AUDIT_FAIL",
      message: `Audit failed with score ${report.overallScore.toFixed(1)}%`,
      details: {
        rulesAudited: report.rulesAudited,
        rulesFailed: report.rulesFailed,
        failedRules: report.findings.filter((f) => !f.passed).map((f) => f.conceptSlug),
      },
    })
  } else if (report.result === "PARTIAL") {
    await raiseAlert({
      severity: "WARNING",
      type: "AUDIT_PARTIAL",
      message: `Audit partial pass with score ${report.overallScore.toFixed(1)}%`,
      details: {
        rulesAudited: report.rulesAudited,
        rulesFailed: report.rulesFailed,
      },
    })
  }
}

/**
 * Send daily digest of warnings
 */
export async function sendDailyDigestEmail(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const warnings = await db.watchdogAlert.findMany({
    where: {
      severity: "WARNING",
      occurredAt: { gte: cutoff },
    },
    orderBy: { occurredAt: "desc" },
  })

  // Gather stats
  const stats = await db.$queryRaw<
    [
      {
        sources: number
        discovered: number
        rules: number
        avgConf: number
      },
    ]
  >`
    SELECT
      (SELECT COUNT(*) FROM "RegulatorySource" WHERE "isActive" = true) as sources,
      (SELECT COUNT(*) FROM "Evidence" WHERE "fetchedAt" >= ${cutoff}) as discovered,
      (SELECT COUNT(*) FROM "RegulatoryRule" WHERE "createdAt" >= ${cutoff}) as rules,
      (SELECT AVG(confidence) FROM "RegulatoryRule" WHERE "createdAt" >= ${cutoff}) as "avgConf"
  `

  await sendDailyDigest(warnings, {
    sourcesChecked: Number(stats[0].sources),
    itemsDiscovered: Number(stats[0].discovered),
    rulesCreated: Number(stats[0].rules),
    avgConfidence: Number(stats[0].avgConf) || 0,
  })
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, userId?: string): Promise<void> {
  await db.watchdogAlert.update({
    where: { id: alertId },
    data: {
      acknowledgedAt: new Date(),
      acknowledgedBy: userId,
    },
  })
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: string): Promise<void> {
  await db.watchdogAlert.update({
    where: { id: alertId },
    data: { resolvedAt: new Date() },
  })
}
