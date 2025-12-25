// src/lib/regulatory-truth/watchdog/resend-email.ts
// Resend-based email sending for regulatory truth alerts and digests

import { sendEmail } from "@/lib/email"
import RegulatoryTruthDigestEmail, {
  type RegulatoryTruthDigestData,
  type TruthHealthData,
  type AlertItem,
  type QueueHealth,
  type ConsolidatorResult,
} from "@/emails/regulatory-truth-digest"
import { db } from "@/lib/db"
import { collectTruthHealthMetrics } from "../utils/truth-health"
import type { WatchdogAlert } from "@prisma/client"

const DIGEST_RECIPIENT = process.env.TRUTH_DIGEST_EMAIL || "wandeon@gmail.com"
const TIMEZONE = process.env.WATCHDOG_TIMEZONE || "Europe/Zagreb"

/**
 * Collect all data for the daily digest
 */
async function collectDigestData(): Promise<RegulatoryTruthDigestData> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Get truth health metrics
  const healthMetrics = await collectTruthHealthMetrics()

  // Get alerts from last 24h
  const alerts = await db.watchdogAlert.findMany({
    where: {
      occurredAt: { gte: cutoff },
    },
    orderBy: [{ severity: "asc" }, { occurredAt: "desc" }],
    take: 50,
  })

  // Map alerts to digest format
  const alertItems: AlertItem[] = alerts.map((alert) => ({
    id: alert.id,
    type: alert.type,
    severity: alert.severity as "CRITICAL" | "WARNING" | "INFO",
    message: alert.message,
    occurredAt: alert.occurredAt,
    occurrenceCount: alert.occurrenceCount,
  }))

  // Get queue health from Redis (simplified - check active jobs)
  const queueHealth: QueueHealth[] = await getQueueHealth()

  // Get consolidator dry-run results (from latest health snapshot)
  const consolidatorResult = await getConsolidatorResult()

  // Map health metrics to digest format
  const truthHealth: TruthHealthData = {
    totalRules: healthMetrics.totalRules,
    publishedRules: healthMetrics.publishedRules,
    publishedPercentage:
      healthMetrics.totalRules > 0
        ? (healthMetrics.publishedRules / healthMetrics.totalRules) * 100
        : 0,
    multiSourceRules: healthMetrics.multiSourceRules,
    singleSourceRules: healthMetrics.singleSourceRules,
    singleSourceBlocked: healthMetrics.singleSourceBlocked,
    singleSourceCanPublish: healthMetrics.singleSourceCanPublish,
    duplicateGroups: healthMetrics.duplicateGroupsDetected,
    orphanedConcepts: healthMetrics.orphanedConcepts,
    unlinkedPointerPercentage: healthMetrics.unlinkedPointersRate * 100,
  }

  return {
    date: new Date(),
    timezone: TIMEZONE,
    truthHealth,
    alerts: alertItems,
    queueHealth,
    consolidatorResult,
  }
}

/**
 * Get queue health status from Redis/BullMQ
 */
async function getQueueHealth(): Promise<QueueHealth[]> {
  try {
    // Try to get queue stats from database or Redis
    // This is a simplified implementation - in production you'd query BullMQ directly
    const queueNames = [
      "sentinel",
      "ocr",
      "extractor",
      "composer",
      "reviewer",
      "arbiter",
      "releaser",
      "scheduled",
    ]

    const health: QueueHealth[] = []

    for (const name of queueNames) {
      // For now, return placeholder values
      // In production, this would query Redis for actual queue stats
      health.push({
        name,
        waiting: 0,
        active: 0,
        failed: 0,
        completed: 0,
      })
    }

    return health
  } catch (error) {
    console.error("[resend-email] Failed to get queue health:", error)
    return []
  }
}

/**
 * Get latest consolidator result from health snapshot
 */
async function getConsolidatorResult(): Promise<ConsolidatorResult | undefined> {
  try {
    const latestSnapshot = await db.truthHealthSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
    })

    if (!latestSnapshot) return undefined

    return {
      duplicateGroupsFound: latestSnapshot.duplicateGroups,
      orphanedConceptsFound: latestSnapshot.orphanedConcepts,
      issuesResolved: 0, // Would need to track this separately
    }
  } catch (error) {
    console.error("[resend-email] Failed to get consolidator result:", error)
    return undefined
  }
}

/**
 * Send the daily regulatory truth digest via Resend
 */
export async function sendRegulatoryTruthDigest(): Promise<boolean> {
  console.log("[resend-email] Preparing regulatory truth daily digest...")

  try {
    const data = await collectDigestData()

    const criticalCount = data.alerts.filter((a) => a.severity === "CRITICAL").length
    const status = criticalCount > 0 ? "CRITICAL" : data.alerts.length > 0 ? "WARNINGS" : "HEALTHY"

    const result = await sendEmail({
      to: DIGEST_RECIPIENT,
      subject: `[FiskAI ${status}] Regulatory Truth Daily Digest - ${data.date.toISOString().split("T")[0]}`,
      react: RegulatoryTruthDigestEmail({ data }),
    })

    if (result.success) {
      console.log(`[resend-email] Daily digest sent to ${DIGEST_RECIPIENT}`)
      return true
    } else {
      console.error("[resend-email] Failed to send digest:", result.error)
      return false
    }
  } catch (error) {
    console.error("[resend-email] Error sending daily digest:", error)
    return false
  }
}

/**
 * Send immediate critical alert via Resend
 */
export async function sendCriticalAlertResend(alert: WatchdogAlert): Promise<boolean> {
  console.log(`[resend-email] Sending critical alert: ${alert.type}`)

  try {
    const result = await sendEmail({
      to: DIGEST_RECIPIENT,
      subject: `[FiskAI CRITICAL] ${alert.type}: ${alert.message}`,
      react: CriticalAlertEmail({ alert }),
    })

    if (result.success) {
      console.log(`[resend-email] Critical alert sent to ${DIGEST_RECIPIENT}`)
      return true
    } else {
      console.error("[resend-email] Failed to send critical alert:", result.error)
      return false
    }
  } catch (error) {
    console.error("[resend-email] Error sending critical alert:", error)
    return false
  }
}

// Simple critical alert email component (inline for now)
import { Html, Head, Body, Container, Section, Text, Link, Heading } from "@react-email/components"
import React from "react"

function CriticalAlertEmail({ alert }: { alert: WatchdogAlert }) {
  return (
    <Html lang="hr">
      <Head />
      <Body
        style={{
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#0f172a",
          padding: "20px",
        }}
      >
        <Container
          style={{
            maxWidth: "500px",
            margin: "0 auto",
            backgroundColor: "#1e293b",
            borderRadius: "12px",
            overflow: "hidden",
            border: "2px solid #ef4444",
          }}
        >
          <Section
            style={{
              background: "linear-gradient(135deg, #ef4444 0%, #991b1b 100%)",
              padding: "20px",
              textAlign: "center" as const,
            }}
          >
            <Heading style={{ color: "#ffffff", margin: 0, fontSize: "20px" }}>
              CRITICAL ALERT
            </Heading>
          </Section>

          <Section style={{ padding: "20px" }}>
            <Text
              style={{
                color: "#ef4444",
                fontSize: "14px",
                fontWeight: 600,
                textTransform: "uppercase" as const,
                margin: "0 0 8px 0",
              }}
            >
              {alert.type}
            </Text>
            <Text style={{ color: "#e2e8f0", fontSize: "16px", margin: "0 0 16px 0" }}>
              {alert.message}
            </Text>
            {alert.entityId && (
              <Text style={{ color: "#94a3b8", fontSize: "13px", margin: "0 0 8px 0" }}>
                Entity: {alert.entityId}
              </Text>
            )}
            <Text style={{ color: "#64748b", fontSize: "12px", margin: 0 }}>
              Occurred: {alert.occurredAt.toISOString()}
            </Text>
          </Section>

          <Section style={{ padding: "20px", textAlign: "center" as const }}>
            <Link
              href="https://admin.fiskai.hr/admin/watchdog"
              style={{
                display: "inline-block",
                backgroundColor: "#ef4444",
                color: "white",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              View Dashboard
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export { collectDigestData, type RegulatoryTruthDigestData }
