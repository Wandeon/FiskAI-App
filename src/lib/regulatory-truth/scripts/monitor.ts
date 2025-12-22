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
 * Continuous monitoring function - checks endpoints based on priority
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

  // Dynamic imports after env is loaded
  const { runSentinel, fetchDiscoveredItems } = await import("../agents/sentinel")
  const { runExtractor } = await import("../agents/extractor")

  const client = await pool.connect()
  try {
    // Map priority filter to DiscoveryPriority enum
    let discoveryPriority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | undefined
    if (priorityFilter === "T0") {
      discoveryPriority = "CRITICAL"
    } else if (priorityFilter === "T1") {
      discoveryPriority = "HIGH"
    } else if (priorityFilter === "T2") {
      discoveryPriority = "MEDIUM"
    } else if (priorityFilter === "T3") {
      discoveryPriority = "LOW"
    }

    // Run Sentinel to discover new items
    console.log(`[monitor] Running discovery for priority: ${discoveryPriority || "ALL"}`)
    const sentinelResult = await runSentinel(discoveryPriority)

    result.sourcesChecked = sentinelResult.endpointsChecked
    result.changesDetected = sentinelResult.newItemsDiscovered
    result.errors.push(...sentinelResult.errors)

    console.log(
      `[monitor] Discovery: ${sentinelResult.endpointsChecked} endpoints, ${sentinelResult.newItemsDiscovered} new items`
    )

    // Fetch discovered items to create Evidence records
    if (sentinelResult.newItemsDiscovered > 0) {
      console.log(`[monitor] Fetching discovered items...`)
      const fetchResult = await fetchDiscoveredItems(Math.min(maxSources, 100))
      result.evidenceCollected = fetchResult.fetched
      console.log(`[monitor] Fetched: ${fetchResult.fetched}, Failed: ${fetchResult.failed}`)
    }

    // If runPipeline is true and we fetched evidence, run extraction
    if (runPipeline && result.evidenceCollected > 0) {
      console.log(`\n[monitor] Running extraction on new evidence...`)

      // Get unprocessed evidence
      const unprocessedEvidence = await client.query(
        `SELECT e.id, s.slug
         FROM "Evidence" e
         JOIN "RegulatorySource" s ON e."sourceId" = s.id
         WHERE NOT EXISTS (
           SELECT 1 FROM "SourcePointer" sp WHERE sp."evidenceId" = e.id
         )
         LIMIT 20`
      )

      for (const evidence of unprocessedEvidence.rows) {
        try {
          const extractResult = await runExtractor(evidence.id)
          if (extractResult.success) {
            result.sourcePointersCreated += extractResult.sourcePointerIds.length
            console.log(
              `[monitor] ✓ Extracted ${extractResult.sourcePointerIds.length} pointers from ${evidence.slug}`
            )
          } else {
            result.errors.push(`Extract failed for ${evidence.slug}: ${extractResult.error}`)
          }
        } catch (error) {
          result.errors.push(`Extract error for ${evidence.slug}: ${error}`)
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      // Compose rules if we created pointers
      if (result.sourcePointersCreated > 0) {
        try {
          const { runComposerBatch } = await import("../agents/composer")
          const { runReviewer } = await import("../agents/reviewer")

          console.log(
            `[monitor] Composing rules from ${result.sourcePointersCreated} new pointers...`
          )
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
