// src/lib/regulatory-truth/watchdog/orchestrator.ts

import { runSentinel, fetchDiscoveredItems } from "../agents/sentinel"
import { runExtractor } from "../agents/extractor"
import { runComposer, groupSourcePointersByDomain } from "../agents/composer"
import { runReviewer, autoApproveEligibleRules } from "../agents/reviewer"
import { runArbiter } from "../agents/arbiter"
import { runReleaser } from "../agents/releaser"
import { buildKnowledgeGraph } from "../graph/knowledge-graph"
import { runAllHealthChecks } from "./health-monitors"
import { runRandomAudit } from "./audit"
import { sendDailyDigestEmail, raiseAlert } from "./alerting"
import { getRandomDelay, sleep } from "./rate-limiter"
import { db } from "@/lib/db"
import type { PhaseResult, WatchdogRunResult } from "./types"
import { runTier1Fetchers } from "../fetchers"

const SCOUT_DELAY_MIN = 50000 // 50 seconds
const SCOUT_DELAY_MAX = 70000 // 70 seconds
const SCRAPE_DELAY_MIN = 20000 // 20 seconds
const SCRAPE_DELAY_MAX = 30000 // 30 seconds
const SCOUT_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const SCRAPE_TIMEOUT_MS = 90 * 60 * 1000 // 90 minutes

/**
 * Run Tier 1 Phase - fetch structured data from official APIs
 */
async function runTier1Phase(): Promise<PhaseResult> {
  const startedAt = new Date()
  let itemsProcessed = 0
  let itemsFailed = 0

  try {
    console.log("\n[watchdog] === TIER 1 PHASE ===")

    const result = await runTier1Fetchers()
    itemsProcessed =
      result.hnb.ratesCreated +
      result.nn.evidenceCreated +
      result.eurlex.evidenceCreated +
      result.mrms.evidenceCreated +
      result.hok.evidenceCreated

    if (result.hnb.error) itemsFailed++
    if (result.nn.error) itemsFailed++
    if (result.eurlex.error) itemsFailed++
    if (result.mrms.error) itemsFailed++
    if (result.hok.error) itemsFailed++

    console.log(
      `[watchdog] Tier 1 complete: HNB=${result.hnb.ratesCreated}, NN=${result.nn.evidenceCreated}, EUR-Lex=${result.eurlex.evidenceCreated}, MRMS=${result.mrms.evidenceCreated}, HOK=${result.hok.evidenceCreated}`
    )

    return {
      phase: "TIER1",
      startedAt,
      completedAt: new Date(),
      success: result.success,
      itemsProcessed,
      itemsFailed,
    }
  } catch (error) {
    return {
      phase: "TIER1",
      startedAt,
      completedAt: new Date(),
      success: false,
      itemsProcessed,
      itemsFailed,
      error: String(error),
    }
  }
}

/**
 * Run Scout Phase - check all endpoints for new items
 */
async function runScoutPhase(): Promise<PhaseResult> {
  const startedAt = new Date()
  let itemsProcessed = 0
  let itemsFailed = 0

  try {
    console.log("\n[watchdog] === SCOUT PHASE ===")

    // Get active endpoints
    const endpoints = await db.regulatorySource.findMany({
      where: { isActive: true },
      orderBy: { hierarchy: "asc" },
    })

    const timeoutAt = Date.now() + SCOUT_TIMEOUT_MS

    for (const endpoint of endpoints) {
      if (Date.now() >= timeoutAt) {
        console.log("[watchdog] Scout phase timeout reached")
        break
      }

      // Random delay between scouts
      const delay = getRandomDelay(SCOUT_DELAY_MIN, SCOUT_DELAY_MAX)
      console.log(`[watchdog] Waiting ${(delay / 1000).toFixed(1)}s before next scout...`)
      await sleep(delay)

      try {
        // Run sentinel for this endpoint's hierarchy
        const result = await runSentinel(endpoint.hierarchy as string)
        itemsProcessed += result.endpointsChecked
        console.log(`[watchdog] Scouted ${endpoint.name}: ${result.newItemsDiscovered} new items`)
      } catch (error) {
        itemsFailed++
        console.error(`[watchdog] Scout failed for ${endpoint.name}:`, error)
      }
    }

    return {
      phase: "SCOUT",
      startedAt,
      completedAt: new Date(),
      success: true,
      itemsProcessed,
      itemsFailed,
    }
  } catch (error) {
    return {
      phase: "SCOUT",
      startedAt,
      completedAt: new Date(),
      success: false,
      itemsProcessed,
      itemsFailed,
      error: String(error),
    }
  }
}

/**
 * Run Scrape Phase - fetch discovered items
 */
async function runScrapePhase(): Promise<PhaseResult> {
  const startedAt = new Date()
  let itemsProcessed = 0
  let itemsFailed = 0

  try {
    console.log("\n[watchdog] === SCRAPE PHASE ===")

    const timeoutAt = Date.now() + SCRAPE_TIMEOUT_MS

    // Fetch in batches with random delays
    while (Date.now() < timeoutAt) {
      const delay = getRandomDelay(SCRAPE_DELAY_MIN, SCRAPE_DELAY_MAX)
      console.log(`[watchdog] Waiting ${(delay / 1000).toFixed(1)}s before next fetch batch...`)
      await sleep(delay)

      const result = await fetchDiscoveredItems(10)
      itemsProcessed += result.fetched
      itemsFailed += result.failed

      if (result.fetched === 0 && result.failed === 0) {
        console.log("[watchdog] No more items to fetch")
        break
      }

      console.log(`[watchdog] Fetched batch: ${result.fetched} success, ${result.failed} failed`)
    }

    return {
      phase: "SCRAPE",
      startedAt,
      completedAt: new Date(),
      success: true,
      itemsProcessed,
      itemsFailed,
    }
  } catch (error) {
    return {
      phase: "SCRAPE",
      startedAt,
      completedAt: new Date(),
      success: false,
      itemsProcessed,
      itemsFailed,
      error: String(error),
    }
  }
}

/**
 * Run Process Phase - extract, compose, review, release
 */
async function runProcessPhase(): Promise<PhaseResult> {
  const startedAt = new Date()
  let itemsProcessed = 0
  let itemsFailed = 0

  try {
    console.log("\n[watchdog] === PROCESS PHASE ===")

    // Extract from unprocessed evidence
    const unprocessedEvidence = await db.evidence.findMany({
      where: {
        sourcePointers: { none: {} },
      },
      take: 20,
    })

    for (const evidence of unprocessedEvidence) {
      try {
        await runExtractor(evidence.id)
        itemsProcessed++
      } catch (error) {
        itemsFailed++
        console.error(`[watchdog] Extract failed for ${evidence.id}:`, error)
      }
    }

    // Compose rules from ungrouped pointers
    const ungroupedPointers = await db.sourcePointer.findMany({
      where: {
        rules: { none: {} },
      },
      select: {
        id: true,
        domain: true,
        extractedValue: true,
        valueType: true,
      },
    })

    if (ungroupedPointers.length > 0) {
      const grouped = groupSourcePointersByDomain(ungroupedPointers)
      for (const [groupKey, pointerIds] of Object.entries(grouped)) {
        try {
          await runComposer(pointerIds)
          itemsProcessed++
        } catch (error) {
          itemsFailed++
          console.error(`[watchdog] Compose failed for ${groupKey}:`, error)
        }
      }
    }

    // Review pending rules
    const pendingRules = await db.regulatoryRule.findMany({
      where: { status: "DRAFT" },
      take: 10,
    })

    for (const rule of pendingRules) {
      try {
        await runReviewer(rule.id)
        itemsProcessed++
      } catch (error) {
        itemsFailed++
        console.error(`[watchdog] Review failed for ${rule.id}:`, error)
      }
    }

    // Auto-approve eligible rules
    await autoApproveEligibleRules()

    // Resolve conflicts
    const openConflicts = await db.regulatoryConflict.findMany({
      where: { status: "OPEN" },
      take: 5,
    })

    for (const conflict of openConflicts) {
      try {
        await runArbiter(conflict.id)
        itemsProcessed++
      } catch (error) {
        itemsFailed++
        console.error(`[watchdog] Arbiter failed for ${conflict.id}:`, error)
      }
    }

    // Release approved rules
    const approvedRules = await db.regulatoryRule.findMany({
      where: {
        status: "APPROVED",
        releases: { none: {} },
      },
      take: 20,
    })

    if (approvedRules.length > 0) {
      try {
        await runReleaser(approvedRules.map((r) => r.id))
        itemsProcessed += approvedRules.length
      } catch (error) {
        itemsFailed += approvedRules.length
        console.error("[watchdog] Release failed:", error)
      }
    }

    // Build knowledge graph
    await buildKnowledgeGraph()

    return {
      phase: "PROCESS",
      startedAt,
      completedAt: new Date(),
      success: true,
      itemsProcessed,
      itemsFailed,
    }
  } catch (error) {
    return {
      phase: "PROCESS",
      startedAt,
      completedAt: new Date(),
      success: false,
      itemsProcessed,
      itemsFailed,
      error: String(error),
    }
  }
}

/**
 * Run Health Phase - check all health monitors
 */
async function runHealthPhase(): Promise<PhaseResult> {
  const startedAt = new Date()

  try {
    console.log("\n[watchdog] === HEALTH PHASE ===")

    const results = await runAllHealthChecks()
    const critical = results.filter((r) => r.status === "CRITICAL").length

    return {
      phase: "HEALTH",
      startedAt,
      completedAt: new Date(),
      success: critical === 0,
      itemsProcessed: results.length,
      itemsFailed: critical,
    }
  } catch (error) {
    return {
      phase: "HEALTH",
      startedAt,
      completedAt: new Date(),
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: String(error),
    }
  }
}

/**
 * Run the full watchdog pipeline
 */
export async function runWatchdogPipeline(): Promise<WatchdogRunResult> {
  const runId = `watchdog-${Date.now()}`
  const startedAt = new Date()
  const phases: PhaseResult[] = []
  const alertsRaised: string[] = []

  console.log("\n========================================")
  console.log("  WATCHDOG PIPELINE STARTING")
  console.log(`  Run ID: ${runId}`)
  console.log(`  Started: ${startedAt.toISOString()}`)
  console.log("========================================\n")

  try {
    // Phase 0: Tier 1 Structured Fetchers
    const tier1Result = await runTier1Phase()
    phases.push(tier1Result)
    if (!tier1Result.success) {
      const alertId = await raiseAlert({
        severity: "WARNING",
        type: "PIPELINE_FAILURE",
        message: `Tier 1 phase failed: ${tier1Result.error}`,
      })
      alertsRaised.push(alertId)
    }

    // Phase 1: Scout
    const scoutResult = await runScoutPhase()
    phases.push(scoutResult)
    if (!scoutResult.success) {
      const alertId = await raiseAlert({
        severity: "CRITICAL",
        type: "PIPELINE_FAILURE",
        message: `Scout phase failed: ${scoutResult.error}`,
      })
      alertsRaised.push(alertId)
    }

    // Phase 2: Scrape
    const scrapeResult = await runScrapePhase()
    phases.push(scrapeResult)
    if (!scrapeResult.success) {
      const alertId = await raiseAlert({
        severity: "CRITICAL",
        type: "PIPELINE_FAILURE",
        message: `Scrape phase failed: ${scrapeResult.error}`,
      })
      alertsRaised.push(alertId)
    }

    // Phase 3: Process
    const processResult = await runProcessPhase()
    phases.push(processResult)
    if (!processResult.success) {
      const alertId = await raiseAlert({
        severity: "CRITICAL",
        type: "PIPELINE_FAILURE",
        message: `Process phase failed: ${processResult.error}`,
      })
      alertsRaised.push(alertId)
    }

    // Phase 4: Health checks
    const healthResult = await runHealthPhase()
    phases.push(healthResult)
  } catch (error) {
    console.error("[watchdog] Fatal error in pipeline:", error)
    const alertId = await raiseAlert({
      severity: "CRITICAL",
      type: "PIPELINE_FAILURE",
      message: `Pipeline fatal error: ${error}`,
    })
    alertsRaised.push(alertId)
  }

  const completedAt = new Date()
  const duration = (completedAt.getTime() - startedAt.getTime()) / 1000

  console.log("\n========================================")
  console.log("  WATCHDOG PIPELINE COMPLETE")
  console.log(`  Duration: ${duration.toFixed(1)}s`)
  console.log(`  Phases: ${phases.length}`)
  console.log(`  Alerts: ${alertsRaised.length}`)
  console.log("========================================\n")

  return {
    runId,
    startedAt,
    completedAt,
    phases,
    alertsRaised,
  }
}

/**
 * Run standalone audit (called separately from main pipeline)
 */
export async function runStandaloneAudit(): Promise<void> {
  console.log("\n[watchdog] Running standalone audit...")
  await runRandomAudit()
}

/**
 * Send daily digest (called at 08:00)
 */
export async function sendDigest(): Promise<void> {
  console.log("\n[watchdog] Sending daily digest...")
  await sendDailyDigestEmail()
}
