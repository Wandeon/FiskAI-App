// src/lib/regulatory-truth/scripts/monitor.ts

import { config } from "dotenv"
import { readFileSync } from "fs"
import { parse } from "dotenv"

// Load environment variables BEFORE importing any modules that use them
config({ path: ".env.local" })

// Load .env but only use OLLAMA vars
try {
  const envContent = readFileSync(".env", "utf-8")
  const parsed = parse(envContent)
  if (parsed.OLLAMA_API_KEY) process.env.OLLAMA_API_KEY = parsed.OLLAMA_API_KEY
  if (parsed.OLLAMA_ENDPOINT) process.env.OLLAMA_ENDPOINT = parsed.OLLAMA_ENDPOINT
  if (parsed.OLLAMA_MODEL) process.env.OLLAMA_MODEL = parsed.OLLAMA_MODEL
} catch {
  // .env may not exist
}

import { Pool } from "pg"

// Create pool for direct SQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

interface MonitoringSchedule {
  priority: "T0" | "T1" | "T2" | "T3"
  intervalHours: number
  description: string
}

// Monitoring schedules based on priority
const MONITORING_SCHEDULES: MonitoringSchedule[] = [
  { priority: "T0", intervalHours: 24, description: "Critical sources - daily" },
  { priority: "T1", intervalHours: 168, description: "High priority - weekly" },
  { priority: "T2", intervalHours: 720, description: "Medium priority - monthly" },
  { priority: "T3", intervalHours: 720, description: "Low priority - monthly" },
]

interface MonitoringResult {
  sourcesChecked: number
  evidenceCollected: number
  changesDetected: number
  sourcePointersCreated: number
  rulesCreated: number
  rulesApproved: number
  errors: string[]
}

/**
 * Determine which sources need checking based on priority and last fetch time
 */
async function getSourcesDueForCheck(
  client: any,
  priorityFilter?: string
): Promise<Array<{ id: string; slug: string; name: string; priority: string }>> {
  // Map fetchIntervalHours to priority tiers
  // T0 (critical): <= 24 hours
  // T1 (high): 25-168 hours (weekly)
  // T2/T3 (medium/low): > 168 hours (monthly)

  let query = `
    SELECT
      id,
      slug,
      name,
      "fetchIntervalHours",
      "lastFetchedAt",
      CASE
        WHEN "fetchIntervalHours" <= 24 THEN 'T0'
        WHEN "fetchIntervalHours" <= 168 THEN 'T1'
        ELSE 'T2'
      END as priority
    FROM "RegulatorySource"
    WHERE "isActive" = true
      AND (
        "lastFetchedAt" IS NULL
        OR "lastFetchedAt" < NOW() - ("fetchIntervalHours" || ' hours')::INTERVAL
      )
  `

  if (priorityFilter) {
    const intervalMap: Record<string, number> = {
      T0: 24,
      T1: 168,
      T2: 720,
      T3: 720,
    }
    const maxInterval = intervalMap[priorityFilter]
    if (priorityFilter === "T0") {
      query += ` AND "fetchIntervalHours" <= 24`
    } else if (priorityFilter === "T1") {
      query += ` AND "fetchIntervalHours" > 24 AND "fetchIntervalHours" <= 168`
    } else {
      query += ` AND "fetchIntervalHours" > 168`
    }
  }

  query += ` ORDER BY
    CASE
      WHEN "fetchIntervalHours" <= 24 THEN 1
      WHEN "fetchIntervalHours" <= 168 THEN 2
      ELSE 3
    END,
    COALESCE("lastFetchedAt", '1970-01-01'::timestamp) ASC
  `

  const result = await client.query(query)
  return result.rows
}

/**
 * Run the monitoring pipeline on a source
 */
async function monitorSource(
  sourceId: string,
  sourceName: string
): Promise<{
  success: boolean
  evidenceId: string | null
  hasChanged: boolean
  sourcePointerIds: string[]
  error: string | null
}> {
  // Dynamic imports after env is loaded
  const { runSentinel } = await import("../agents/sentinel")
  const { runExtractor } = await import("../agents/extractor")

  // Step 1: Run Sentinel to fetch and detect changes
  console.log(`[monitor] Checking source: ${sourceName}`)
  const sentinelResult = await runSentinel(sourceId)

  if (!sentinelResult.success || !sentinelResult.evidenceId) {
    return {
      success: false,
      evidenceId: null,
      hasChanged: false,
      sourcePointerIds: [],
      error: sentinelResult.error,
    }
  }

  // Step 2: If content changed, extract data points
  if (sentinelResult.hasChanged) {
    console.log(`[monitor] Change detected - extracting data points...`)
    const extractorResult = await runExtractor(sentinelResult.evidenceId)

    if (extractorResult.success) {
      console.log(`[monitor] ✓ Extracted ${extractorResult.sourcePointerIds.length} data points`)
      return {
        success: true,
        evidenceId: sentinelResult.evidenceId,
        hasChanged: true,
        sourcePointerIds: extractorResult.sourcePointerIds,
        error: null,
      }
    } else {
      return {
        success: false,
        evidenceId: sentinelResult.evidenceId,
        hasChanged: true,
        sourcePointerIds: [],
        error: extractorResult.error,
      }
    }
  } else {
    console.log(`[monitor] ✓ No changes detected`)
    return {
      success: true,
      evidenceId: sentinelResult.evidenceId,
      hasChanged: false,
      sourcePointerIds: [],
      error: null,
    }
  }
}

/**
 * Continuous monitoring function - checks sources based on priority
 */
export async function runMonitoring(options?: {
  priorityFilter?: "T0" | "T1" | "T2" | "T3"
  maxSources?: number
  runPipeline?: boolean
}): Promise<MonitoringResult> {
  const { priorityFilter, maxSources = 100, runPipeline = false } = options || {}

  const result: MonitoringResult = {
    sourcesChecked: 0,
    evidenceCollected: 0,
    changesDetected: 0,
    sourcePointersCreated: 0,
    rulesCreated: 0,
    rulesApproved: 0,
    errors: [],
  }

  console.log("=".repeat(60))
  console.log("REGULATORY TRUTH LAYER - MONITORING")
  console.log("=".repeat(60))

  if (priorityFilter) {
    const schedule = MONITORING_SCHEDULES.find((s) => s.priority === priorityFilter)
    console.log(`Priority Filter: ${priorityFilter} (${schedule?.description || "unknown"})`)
  } else {
    console.log("Checking all sources due for update")
  }

  const client = await pool.connect()
  try {
    // Get sources that need checking
    const sources = await getSourcesDueForCheck(client, priorityFilter)
    const sourcesToCheck = sources.slice(0, maxSources)

    console.log(
      `\nFound ${sources.length} sources due for check (processing ${sourcesToCheck.length})`
    )

    if (sourcesToCheck.length === 0) {
      console.log("No sources need checking at this time")
      return result
    }

    // Monitor each source
    for (const source of sourcesToCheck) {
      try {
        const monitorResult = await monitorSource(source.id, source.name)

        result.sourcesChecked++

        if (monitorResult.success) {
          if (monitorResult.evidenceId) {
            result.evidenceCollected++
          }
          if (monitorResult.hasChanged) {
            result.changesDetected++
            result.sourcePointersCreated += monitorResult.sourcePointerIds.length
          }
        } else {
          const msg = `${source.slug}: ${monitorResult.error}`
          result.errors.push(msg)
          console.log(`[monitor] ✗ ${msg}`)
        }
      } catch (error) {
        const msg = `${source.slug}: ${error}`
        result.errors.push(msg)
        console.error(`[monitor] ✗ ${msg}`)
      }

      // Rate limiting - wait 2 seconds between sources
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    // If changes were detected and runPipeline is true, trigger composition and review
    if (runPipeline && result.sourcePointersCreated > 0) {
      console.log(`\n[monitor] Changes detected - running composition and review pipeline...`)

      try {
        const { runComposerBatch } = await import("../agents/composer")
        const { runReviewer } = await import("../agents/reviewer")

        // Compose rules
        console.log(`[monitor] Composing rules from new data points...`)
        const composerResult = await runComposerBatch()
        result.rulesCreated = composerResult.totalRules
        result.errors.push(...composerResult.errors)

        if (composerResult.totalRules > 0) {
          console.log(`[monitor] ✓ Created ${composerResult.totalRules} draft rules`)

          // Review draft rules
          console.log(`[monitor] Reviewing draft rules...`)
          const draftRules = await client.query(
            `SELECT id, "conceptSlug", "riskTier" FROM "RegulatoryRule"
             WHERE status = 'DRAFT'
             ORDER BY "createdAt" DESC
             LIMIT 20`
          )

          for (const rule of draftRules.rows) {
            try {
              const reviewerResult = await runReviewer(rule.id)

              if (reviewerResult.success) {
                // Check if auto-approved
                const updatedRule = await client.query(
                  `SELECT status FROM "RegulatoryRule" WHERE id = $1`,
                  [rule.id]
                )

                if (updatedRule.rows[0]?.status === "APPROVED") {
                  result.rulesApproved++
                  console.log(`[monitor] ✓ Rule auto-approved: ${rule.conceptSlug}`)
                }
              } else {
                result.errors.push(`Review failed for ${rule.conceptSlug}`)
              }
            } catch (error) {
              result.errors.push(`Review error for ${rule.conceptSlug}: ${error}`)
            }

            // Rate limiting
            await new Promise((resolve) => setTimeout(resolve, 3000))
          }
        }
      } catch (error) {
        result.errors.push(`Pipeline error: ${error}`)
        console.error(`[monitor] Pipeline error: ${error}`)
      }
    }
  } finally {
    client.release()
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("MONITORING COMPLETE")
  console.log("=".repeat(60))
  console.log(`Sources checked: ${result.sourcesChecked}`)
  console.log(`Evidence collected: ${result.evidenceCollected}`)
  console.log(`Changes detected: ${result.changesDetected}`)
  console.log(`Source pointers created: ${result.sourcePointersCreated}`)
  if (runPipeline) {
    console.log(`Rules created: ${result.rulesCreated}`)
    console.log(`Rules auto-approved: ${result.rulesApproved}`)
  }
  console.log(`Errors: ${result.errors.length}`)

  if (result.errors.length > 0) {
    console.log("\nErrors:")
    result.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`))
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more`)
    }
  }

  return result
}

// CLI runner
if (require.main === module) {
  const args = process.argv.slice(2)
  const priorityArg = args.find((a) => a.startsWith("--priority="))
  const maxSourcesArg = args.find((a) => a.startsWith("--max="))
  const runPipelineArg = args.includes("--pipeline")

  const priority = priorityArg
    ? (priorityArg.split("=")[1] as "T0" | "T1" | "T2" | "T3")
    : undefined
  const maxSources = maxSourcesArg ? parseInt(maxSourcesArg.split("=")[1]) : 100

  console.log("\nUsage:")
  console.log("  npm run monitor                           # Check all sources due")
  console.log("  npm run monitor -- --priority=T0          # Check only T0 (daily)")
  console.log("  npm run monitor -- --priority=T1          # Check only T1 (weekly)")
  console.log("  npm run monitor -- --priority=T2          # Check only T2/T3 (monthly)")
  console.log("  npm run monitor -- --max=50               # Limit to 50 sources")
  console.log("  npm run monitor -- --priority=T0 --pipeline  # Check T0 and run full pipeline\n")

  runMonitoring({ priorityFilter: priority, maxSources, runPipeline: runPipelineArg })
    .then(async (result) => {
      await pool.end()
      process.exit(result.errors.length > 0 ? 1 : 0)
    })
    .catch(async (error) => {
      console.error("[monitor] Fatal error:", error)
      await pool.end()
      process.exit(1)
    })
}
