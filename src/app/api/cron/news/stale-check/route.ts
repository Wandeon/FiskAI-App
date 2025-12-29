/**
 * CRON: Stale Content Detection (recommended: runs daily at 06:00)
 *
 * Process:
 * 1. Check all published posts for staleness
 * 2. Update freshness status based on age thresholds
 * 3. Flag expired content
 * 4. Auto-archive very old posts
 * 5. Generate alerts for content needing review
 */
import { NextRequest, NextResponse } from "next/server"
import {
  checkAllPostsStaleness,
  archiveOldPosts,
  getFreshnessStats,
  type StalenessCheckSummary,
} from "@/lib/news/pipeline/staleness-checker"

export const dynamic = "force-dynamic"
export const maxDuration = 120 // 2 minutes

interface StaleCheckResult {
  success: boolean
  summary: StalenessCheckSummary
  archiveResult: {
    archived: number
  }
  stats: {
    total: number
    fresh: number
    stale: number
    expired: number
    archived: number
    neverChecked: number
    averageAge: number | null
  }
  alerts: {
    type: "warning" | "critical"
    message: string
  }[]
}

export async function GET(request: NextRequest) {
  console.log("[CRON] Starting stale content check...")

  const result: StaleCheckResult = {
    success: false,
    summary: {
      checked: 0,
      fresh: 0,
      stale: 0,
      expired: 0,
      archived: 0,
      warnings: 0,
      errors: [],
    },
    archiveResult: { archived: 0 },
    stats: {
      total: 0,
      fresh: 0,
      stale: 0,
      expired: 0,
      archived: 0,
      neverChecked: 0,
      averageAge: null,
    },
    alerts: [],
  }

  try {
    // 1. Verify authorization
    const authHeader = request.headers.get("authorization")
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (!authHeader || authHeader !== expectedAuth) {
      console.error("[CRON] Stale check - Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Run staleness check on all published posts
    console.log("[CRON] Checking all published posts for staleness...")
    const { summary } = await checkAllPostsStaleness()
    result.summary = summary

    console.log(`[CRON] Staleness check complete:`)
    console.log(`  - Checked: ${summary.checked}`)
    console.log(`  - Fresh: ${summary.fresh}`)
    console.log(`  - Stale: ${summary.stale}`)
    console.log(`  - Expired: ${summary.expired}`)
    console.log(`  - Warnings: ${summary.warnings}`)

    // 3. Auto-archive very old posts (older than 180 days)
    console.log("[CRON] Archiving old posts...")
    const archiveResult = await archiveOldPosts(180)
    result.archiveResult = archiveResult

    if (archiveResult.archived > 0) {
      console.log(`[CRON] Archived ${archiveResult.archived} old posts`)
    }

    // 4. Get freshness statistics
    const stats = await getFreshnessStats()
    result.stats = stats

    // 5. Generate alerts
    const stalePercentage = stats.total > 0 ? (stats.stale / stats.total) * 100 : 0
    const expiredPercentage = stats.total > 0 ? (stats.expired / stats.total) * 100 : 0

    if (expiredPercentage > 5) {
      result.alerts.push({
        type: "critical",
        message: `${stats.expired} posts (${expiredPercentage.toFixed(1)}%) have expired content - immediate review required`,
      })
    }

    if (stalePercentage > 20) {
      result.alerts.push({
        type: "critical",
        message: `${stats.stale} posts (${stalePercentage.toFixed(1)}%) are stale - content review recommended`,
      })
    } else if (stalePercentage > 10) {
      result.alerts.push({
        type: "warning",
        message: `${stats.stale} posts (${stalePercentage.toFixed(1)}%) are stale - consider reviewing`,
      })
    }

    if (summary.warnings > 0) {
      result.alerts.push({
        type: "warning",
        message: `${summary.warnings} posts will become stale within 7 days`,
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
    console.log("[CRON] Stale content check complete!")

    return NextResponse.json(result)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error("[CRON] Stale check fatal error:", errorMsg)
    result.summary.errors.push(errorMsg)

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: errorMsg,
        ...result,
      },
      { status: 500 }
    )
  }
}
