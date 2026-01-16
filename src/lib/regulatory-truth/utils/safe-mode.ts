// src/lib/regulatory-truth/utils/safe-mode.ts
//
// Safe Mode Escalation Triggers per Appendix A
// Monitors autonomous RTL for quality issues that require human intervention

import { db, dbReg } from "@/lib/db"

export interface SafeModeStatus {
  isTriggered: boolean
  triggers: SafeModeTrigger[]
  checkedAt: Date
}

export interface SafeModeTrigger {
  type: "HIGH_REVOCATION_RATE" | "T0T1_MISSING_QUOTE" | "CONFLICT_SPIKE" | "SOURCE_UNAVAILABLE"
  severity: "CRITICAL" | "WARNING"
  message: string
  value: number
  threshold: number
}

const THRESHOLDS = {
  /** Max revocation rate before safe mode (5%) */
  MAX_REVOCATION_RATE: 0.05,
  /** Conflict rate multiplier before safe mode (2x) */
  CONFLICT_RATE_MULTIPLIER: 2.0,
  /** Min source availability (95%) */
  MIN_SOURCE_AVAILABILITY: 0.95,
}

/**
 * Check if safe mode should be triggered
 *
 * Per Appendix A, safe mode is triggered if:
 * 1. >5% of daily published rules are revoked in 24h
 * 2. Any T0/T1 rule is published without source pointers
 * 3. Conflict rate increases 2x over 7-day baseline
 * 4. Source availability drops below 95%
 */
export async function checkSafeModeConditions(): Promise<SafeModeStatus> {
  const triggers: SafeModeTrigger[] = []
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // 1. Check revocation rate
  const publishedLast24h = await db.regulatoryRule.count({
    where: {
      status: "PUBLISHED",
      updatedAt: { gte: yesterday },
    },
  })

  const revokedLast24h = await db.regulatoryRule.count({
    where: {
      revokedAt: { gte: yesterday },
    },
  })

  if (publishedLast24h > 0) {
    const revocationRate = revokedLast24h / publishedLast24h
    if (revocationRate > THRESHOLDS.MAX_REVOCATION_RATE) {
      triggers.push({
        type: "HIGH_REVOCATION_RATE",
        severity: "CRITICAL",
        message: `${(revocationRate * 100).toFixed(1)}% of published rules revoked in 24h (threshold: ${THRESHOLDS.MAX_REVOCATION_RATE * 100}%)`,
        value: revocationRate,
        threshold: THRESHOLDS.MAX_REVOCATION_RATE,
      })
    }
  }

  // 2. Check for T0/T1 rules without source pointers
  const t0t1WithoutQuotes = await db.regulatoryRule.findMany({
    where: {
      status: "PUBLISHED",
      riskTier: { in: ["T0", "T1"] },
      sourcePointers: { none: {} },
    },
    select: { id: true, conceptSlug: true, riskTier: true },
  })

  if (t0t1WithoutQuotes.length > 0) {
    triggers.push({
      type: "T0T1_MISSING_QUOTE",
      severity: "CRITICAL",
      message: `${t0t1WithoutQuotes.length} T0/T1 rules published without source pointers: ${t0t1WithoutQuotes.map((r) => r.conceptSlug).join(", ")}`,
      value: t0t1WithoutQuotes.length,
      threshold: 0,
    })
  }

  // 3. Check conflict rate spike
  const conflictsThisWeek = await db.regulatoryConflict.count({
    where: { createdAt: { gte: weekAgo } },
  })

  const conflictsPreviousWeek = await db.regulatoryConflict.count({
    where: {
      createdAt: {
        gte: new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000),
        lt: weekAgo,
      },
    },
  })

  if (conflictsPreviousWeek > 0) {
    const conflictRatio = conflictsThisWeek / conflictsPreviousWeek
    if (conflictRatio >= THRESHOLDS.CONFLICT_RATE_MULTIPLIER) {
      triggers.push({
        type: "CONFLICT_SPIKE",
        severity: "WARNING",
        message: `Conflict rate ${conflictRatio.toFixed(1)}x higher than 7-day baseline (${conflictsThisWeek} vs ${conflictsPreviousWeek})`,
        value: conflictRatio,
        threshold: THRESHOLDS.CONFLICT_RATE_MULTIPLIER,
      })
    }
  }

  // 4. Check source availability
  const totalSources = await dbReg.regulatorySource.count({
    where: { isActive: true },
  })

  const unavailableSources = await dbReg.evidence.count({
    where: {
      stalenessStatus: "UNAVAILABLE",
      fetchedAt: { gte: yesterday },
    },
  })

  if (totalSources > 0) {
    const availabilityRate = 1 - unavailableSources / totalSources
    if (availabilityRate < THRESHOLDS.MIN_SOURCE_AVAILABILITY) {
      triggers.push({
        type: "SOURCE_UNAVAILABLE",
        severity: "WARNING",
        message: `Source availability at ${(availabilityRate * 100).toFixed(1)}% (threshold: ${THRESHOLDS.MIN_SOURCE_AVAILABILITY * 100}%)`,
        value: availabilityRate,
        threshold: THRESHOLDS.MIN_SOURCE_AVAILABILITY,
      })
    }
  }

  const status: SafeModeStatus = {
    isTriggered: triggers.some((t) => t.severity === "CRITICAL"),
    triggers,
    checkedAt: now,
  }

  // Log status
  if (status.isTriggered) {
    console.error("[safe-mode] CRITICAL: Safe mode should be activated!", {
      triggers: triggers.filter((t) => t.severity === "CRITICAL"),
    })
  } else if (triggers.length > 0) {
    console.warn("[safe-mode] Warnings detected:", {
      triggers,
    })
  } else {
    console.log("[safe-mode] All conditions nominal")
  }

  return status
}

/**
 * Get safe mode configuration recommendations based on current status
 */
export function getSafeModeConfig(status: SafeModeStatus): {
  AUTO_APPROVE_ALL_TIERS: string
  AUTO_APPROVE_GRACE_HOURS: string
} {
  if (status.isTriggered) {
    // Safe mode: disable T0/T1 auto-approve, increase grace period
    return {
      AUTO_APPROVE_ALL_TIERS: "false",
      AUTO_APPROVE_GRACE_HOURS: "24",
    }
  }
  // Normal mode
  return {
    AUTO_APPROVE_ALL_TIERS: "true",
    AUTO_APPROVE_GRACE_HOURS: "1",
  }
}

/**
 * Log safe mode decision for audit trail
 */
export async function logSafeModeDecision(
  status: SafeModeStatus,
  action: "ACTIVATE" | "DEACTIVATE" | "CHECK_ONLY"
): Promise<void> {
  // Log to audit table (using existing audit infrastructure)
  console.log("[safe-mode] Decision logged:", {
    action,
    isTriggered: status.isTriggered,
    triggerCount: status.triggers.length,
    checkedAt: status.checkedAt,
  })

  // In production, this would also:
  // 1. Write to MonitoringAlert table
  // 2. Send notifications (Telegram, email)
  // 3. Update feature flags if action != CHECK_ONLY
}
