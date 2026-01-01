/**
 * CRON: RTL Evidence Staleness Check (recommended: runs daily at 05:00)
 *
 * Implements GitHub issue #893: RTL Stale data handling
 *
 * Process:
 * 1. Check evidence records for staleness (age, source availability, content changes)
 * 2. Auto-deprecate rules past their effectiveUntil dates
 * 3. Queue stale evidence for re-crawl
 * 4. Generate alerts for critical staleness issues
 */
import { NextRequest, NextResponse } from "next/server"
import {
  checkAllEvidenceStaleness,
  deprecateExpiredRules,
  queueStaleEvidenceForRecrawl,
  getStalenessStats,
  type StalenessCheckResult,
  type RuleDeprecationResult,
} from "@/lib/regulatory-truth/services/evidence-staleness-service"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

interface RtlStalenessResult {
  success: boolean
  evidenceCheck: StalenessCheckResult
  ruleDeprecation: RuleDeprecationResult
  recrawlQueue: {
    queued: number
    errors: string[]
  }
  stats: {
    total: number
    fresh: number
    aging: number
    stale: number
    expired: number
    neverVerified: number
    changedContent: number
  }
  alerts: {
    type: "warning" | "critical"
    message: string
  }[]
  durationMs: number
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log("[CRON] Starting RTL staleness check...")

  const result: RtlStalenessResult = {
    success: false,
    evidenceCheck: {
      success: false,
      checked: 0,
      stale: 0,
      expired: 0,
      unavailable: 0,
      changed: 0,
      errors: [],
    },
    ruleDeprecation: {
      success: false,
      deprecated: 0,
      errors: [],
    },
    recrawlQueue: {
      queued: 0,
      errors: [],
    },
    stats: {
      total: 0,
      fresh: 0,
      aging: 0,
      stale: 0,
      expired: 0,
      neverVerified: 0,
      changedContent: 0,
    },
    alerts: [],
    durationMs: 0,
  }

  try {
    // 1. Verify authorization
    const authHeader = request.headers.get("authorization")
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!authHeader || authHeader !== expectedAuth) {
      console.error("[CRON] RTL staleness - Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Check evidence staleness
    console.log("[CRON] Checking evidence staleness...")
    result.evidenceCheck = await checkAllEvidenceStaleness(100)
    console.log(
      `[CRON] Evidence check: ${result.evidenceCheck.checked} checked, ${result.evidenceCheck.stale} stale`
    )

    // 3. Auto-deprecate expired rules
    console.log("[CRON] Deprecating expired rules...")
    result.ruleDeprecation = await deprecateExpiredRules()
    console.log(`[CRON] Deprecated ${result.ruleDeprecation.deprecated} rules`)

    // 4. Queue stale evidence for re-crawl
    console.log("[CRON] Queueing stale evidence for re-crawl...")
    result.recrawlQueue = await queueStaleEvidenceForRecrawl(50)
    console.log(`[CRON] Queued ${result.recrawlQueue.queued} items for re-crawl`)

    // 5. Get staleness statistics
    result.stats = await getStalenessStats()

    // 6. Generate alerts
    const stalePercentage =
      result.stats.total > 0
        ? ((result.stats.stale + result.stats.expired) / result.stats.total) * 100
        : 0
    const expiredPercentage =
      result.stats.total > 0 ? (result.stats.expired / result.stats.total) * 100 : 0

    if (expiredPercentage > 10) {
      result.alerts.push({
        type: "critical",
        message: `${result.stats.expired} evidence records (${expiredPercentage.toFixed(1)}%) are expired - regulatory data may be outdated`,
      })
    }

    if (stalePercentage > 25) {
      result.alerts.push({
        type: "critical",
        message: `${result.stats.stale + result.stats.expired} evidence records (${stalePercentage.toFixed(1)}%) are stale - verification needed`,
      })
    } else if (stalePercentage > 10) {
      result.alerts.push({
        type: "warning",
        message: `${result.stats.stale + result.stats.expired} evidence records (${stalePercentage.toFixed(1)}%) are stale`,
      })
    }

    if (result.evidenceCheck.changed > 0) {
      result.alerts.push({
        type: "warning",
        message: `${result.evidenceCheck.changed} source documents have changed - re-extraction may be needed`,
      })
    }

    if (result.ruleDeprecation.deprecated > 0) {
      result.alerts.push({
        type: "warning",
        message: `${result.ruleDeprecation.deprecated} rules were auto-deprecated due to expired effectiveUntil dates`,
      })
    }

    // Log alerts
    for (const alert of result.alerts) {
      if (alert.type === "critical") {
        console.error(`[CRON] ALERT (CRITICAL): ${alert.message}`)
      } else {
        console.warn(`[CRON] ALERT (WARNING): ${alert.message}`)
      }
    }

    result.success = true
    result.durationMs = Date.now() - startTime
    console.log(`[CRON] RTL staleness check complete in ${result.durationMs}ms`)

    return NextResponse.json(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[CRON] RTL staleness fatal error:", errorMsg)
    result.durationMs = Date.now() - startTime

    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    return NextResponse.json(
      {
        ...result,
        success: false,
        error: "Internal server error",
        details: errorMsg,
      },
      { status: 500 }
    )
  }
}
