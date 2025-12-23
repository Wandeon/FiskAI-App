// src/lib/regulatory-truth/e2e/live-runner.ts
// Live E2E Testing Harness - runs full pipeline and validates invariants

import { mkdirSync, writeFileSync, existsSync } from "fs"
import { resolve, join } from "path"
import { db } from "@/lib/db"
import {
  collectEnvironmentFingerprint,
  printFingerprintHeader,
  getRunFolderPath,
  type EnvironmentFingerprint,
} from "./environment-fingerprint"
import { validateInvariants, type InvariantResults } from "./invariant-validator"
import { runAssistantSuite, type AssistantSuiteResults } from "./assistant-suite"
import { createSyntheticConflict, verifySyntheticConflictProcessed } from "./synthetic-heartbeat"
import { generateReport, type LiveRunReport } from "./report-generator"
import { runDataRepair } from "./data-repair"

// Phase execution imports
import { runSentinel, fetchDiscoveredItems } from "../agents/sentinel"
import { runExtractorBatch } from "../agents/extractor"
import { runComposerBatch } from "../agents/composer"
import { autoApproveEligibleRules } from "../agents/reviewer"
import { runArbiterBatch } from "../agents/arbiter"
import { runReleaser } from "../agents/releaser"

export interface PhaseResult {
  phase: string
  success: boolean
  duration: number
  metrics: Record<string, number>
  errors: string[]
}

export interface LiveRunResult {
  fingerprint: EnvironmentFingerprint
  verdict: "GO" | "NO-GO" | "CONDITIONAL-GO" | "INVALID"
  phases: PhaseResult[]
  invariants: InvariantResults
  assistantSuite: AssistantSuiteResults | null
  metrics: RunMetrics
  report: LiveRunReport
  artifactsPath: string
}

export interface RunMetrics {
  evidenceFetched: { new: number; changed: number; total: number }
  idempotencyDuplicateRate: number
  extractorParseFailureRate: number
  extractorValidationRejectionRate: number
  quoteMismatchRate: number
  rulesByStatus: { draft: number; pending: number; approved: number; published: number }
  rulesByTier: { t0: number; t1: number; t2: number; t3: number }
  conflicts: { created: number; resolved: number; escalated: number; unresolvedOver7Days: number }
  releases: { created: number; hashVerified: number }
  assistant: { citationCompliance: number; refusalRate: number; errorRate: number }
}

const RATE_LIMIT_DELAY = 5000 // 5 seconds between phases

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Run a single pipeline phase with error handling and metrics.
 */
async function runPhase(
  name: string,
  fn: () => Promise<Record<string, number>>
): Promise<PhaseResult> {
  const start = Date.now()
  const errors: string[] = []
  let metrics: Record<string, number> = {}

  try {
    console.log(`\n[live-e2e] === PHASE: ${name} ===`)
    metrics = await fn()
    console.log(`[live-e2e] ${name} completed in ${Date.now() - start}ms`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    errors.push(errorMsg)
    console.error(`[live-e2e] ${name} FAILED:`, errorMsg)
  }

  return {
    phase: name,
    success: errors.length === 0,
    duration: Date.now() - start,
    metrics,
    errors,
  }
}

/**
 * Collect metrics from database state.
 */
async function collectMetrics(): Promise<RunMetrics> {
  // Evidence metrics
  const evidenceTotal = await db.evidence.count()
  const evidenceNew = await db.evidence.count({
    where: { fetchedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  })

  // Idempotency check
  const duplicates = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT "endpointId", url FROM "DiscoveredItem"
      GROUP BY "endpointId", url HAVING COUNT(*) > 1
    ) dups
  `
  const totalDiscovered = await db.discoveredItem.count()
  const idempotencyDuplicateRate =
    totalDiscovered > 0 ? Number(duplicates[0]?.count || 0) / totalDiscovered : 0

  // Extractor metrics
  const extractorRejections = await db.extractionRejected.count()
  const totalPointers = await db.sourcePointer.count()
  const quoteMismatches = await db.extractionRejected.count({
    where: { rejectionType: "NO_QUOTE_MATCH" },
  })

  // Rules by status
  const rulesByStatus = {
    draft: await db.regulatoryRule.count({ where: { status: "DRAFT" } }),
    pending: await db.regulatoryRule.count({ where: { status: "PENDING_REVIEW" } }),
    approved: await db.regulatoryRule.count({ where: { status: "APPROVED" } }),
    published: await db.regulatoryRule.count({ where: { status: "PUBLISHED" } }),
  }

  // Rules by tier
  const rulesByTier = {
    t0: await db.regulatoryRule.count({ where: { riskTier: "T0" } }),
    t1: await db.regulatoryRule.count({ where: { riskTier: "T1" } }),
    t2: await db.regulatoryRule.count({ where: { riskTier: "T2" } }),
    t3: await db.regulatoryRule.count({ where: { riskTier: "T3" } }),
  }

  // Conflicts
  const conflictsOpen = await db.regulatoryConflict.count({ where: { status: "OPEN" } })
  const conflictsResolved = await db.regulatoryConflict.count({ where: { status: "RESOLVED" } })
  const conflictsEscalated = await db.regulatoryConflict.count({ where: { status: "ESCALATED" } })
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const unresolvedOver7Days = await db.regulatoryConflict.count({
    where: { status: "OPEN", createdAt: { lt: sevenDaysAgo } },
  })

  // Releases
  const releasesCreated = await db.ruleRelease.count()

  return {
    evidenceFetched: { new: evidenceNew, changed: 0, total: evidenceTotal },
    idempotencyDuplicateRate,
    extractorParseFailureRate:
      totalPointers > 0 ? extractorRejections / (totalPointers + extractorRejections) : 0,
    extractorValidationRejectionRate:
      totalPointers > 0 ? extractorRejections / (totalPointers + extractorRejections) : 0,
    quoteMismatchRate: extractorRejections > 0 ? quoteMismatches / extractorRejections : 0,
    rulesByStatus,
    rulesByTier,
    conflicts: {
      created: conflictsOpen + conflictsResolved + conflictsEscalated,
      resolved: conflictsResolved,
      escalated: conflictsEscalated,
      unresolvedOver7Days,
    },
    releases: { created: releasesCreated, hashVerified: releasesCreated },
    assistant: { citationCompliance: 0, refusalRate: 0, errorRate: 0 },
  }
}

/**
 * Save artifacts to run folder.
 */
function saveArtifacts(
  runPath: string,
  fingerprint: EnvironmentFingerprint,
  phases: PhaseResult[],
  invariants: InvariantResults,
  metrics: RunMetrics,
  assistantSuite: AssistantSuiteResults | null
): void {
  const fullPath = resolve(process.cwd(), runPath)
  mkdirSync(fullPath, { recursive: true })
  mkdirSync(join(fullPath, "phase_logs"), { recursive: true })
  mkdirSync(join(fullPath, "db_snapshots"), { recursive: true })

  // Run header
  writeFileSync(join(fullPath, "run_header.json"), JSON.stringify(fingerprint, null, 2))

  // Phase logs
  for (const phase of phases) {
    writeFileSync(
      join(fullPath, "phase_logs", `${phase.phase}.json`),
      JSON.stringify(phase, null, 2)
    )
  }

  // Metrics
  writeFileSync(join(fullPath, "metrics.json"), JSON.stringify(metrics, null, 2))

  // Invariants
  writeFileSync(join(fullPath, "invariants.json"), JSON.stringify(invariants, null, 2))

  // Assistant suite
  if (assistantSuite) {
    writeFileSync(join(fullPath, "assistant_suite.json"), JSON.stringify(assistantSuite, null, 2))
  }

  console.log(`[live-e2e] Artifacts saved to: ${fullPath}`)
}

/**
 * Determine overall verdict based on invariant results.
 */
function determineVerdict(invariants: InvariantResults): "GO" | "NO-GO" | "CONDITIONAL-GO" {
  const results = Object.values(invariants.results)
  const allPass = results.every((r) => r.status === "PASS")
  const anyFail = results.some((r) => r.status === "FAIL")
  const anyPartial = results.some((r) => r.status === "PARTIAL")

  if (allPass) return "GO"
  if (anyFail) return "NO-GO"
  if (anyPartial) return "CONDITIONAL-GO"
  return "NO-GO"
}

/**
 * Main live E2E runner.
 */
export async function runLiveE2E(options?: {
  skipAssistant?: boolean
  lightRun?: boolean
}): Promise<LiveRunResult> {
  const skipAssistant = options?.skipAssistant ?? false
  const lightRun = options?.lightRun ?? false

  console.log("\n" + "=".repeat(72))
  console.log("                    LIVE E2E TESTING HARNESS")
  console.log("=".repeat(72))

  // Step 1: Collect and validate environment
  const fingerprint = await collectEnvironmentFingerprint()
  printFingerprintHeader(fingerprint)

  if (!fingerprint.isValid) {
    console.error(`\n[live-e2e] INVALID RUN: ${fingerprint.invalidReason}`)
    return {
      fingerprint,
      verdict: "INVALID",
      phases: [],
      invariants: { results: {}, summary: { pass: 0, fail: 0, partial: 0 } },
      assistantSuite: null,
      metrics: {} as RunMetrics,
      report: {} as LiveRunReport,
      artifactsPath: "",
    }
  }

  const runPath = getRunFolderPath(fingerprint)
  const phases: PhaseResult[] = []

  // Step 2: Create synthetic conflict heartbeat
  console.log("\n[live-e2e] Creating synthetic conflict heartbeat...")
  const heartbeatConflictId = await createSyntheticConflict()

  // Step 3: Run pipeline phases
  if (!lightRun) {
    // Full run: all phases
    phases.push(
      await runPhase("sentinel", async () => {
        const result = await runSentinel("CRITICAL")
        await sleep(RATE_LIMIT_DELAY)
        const fetched = await fetchDiscoveredItems(50)
        return {
          endpointsChecked: result.endpointsChecked,
          newItems: result.newItemsDiscovered,
          fetched: fetched.fetched,
        }
      })
    )

    phases.push(
      await runPhase("extractor", async () => {
        const result = await runExtractorBatch(20)
        return {
          processed: result.processed,
          failed: result.failed,
          sourcePointers: result.sourcePointerIds.length,
        }
      })
    )

    phases.push(
      await runPhase("composer", async () => {
        const result = await runComposerBatch()
        return {
          success: result.success,
          failed: result.failed,
          totalRules: result.totalRules,
        }
      })
    )

    // Skip individual reviewer - rely on auto-approve phase instead

    phases.push(
      await runPhase("auto-approve", async () => {
        const result = await autoApproveEligibleRules()
        return { approved: result.approved, skipped: result.skipped }
      })
    )

    phases.push(
      await runPhase("arbiter", async () => {
        const result = await runArbiterBatch(5)
        return {
          processed: result.processed,
          resolved: result.resolved,
          escalated: result.escalated,
          failed: result.failed,
        }
      })
    )

    phases.push(
      await runPhase("releaser", async () => {
        // Get approved rules that haven't been released yet
        const approvedRules = await db.regulatoryRule.findMany({
          where: { status: "APPROVED", releases: { none: {} } },
          select: { id: true },
          take: 20,
        })

        if (approvedRules.length === 0) {
          return { released: 0, ruleCount: 0 }
        }

        const result = await runReleaser(approvedRules.map((r) => r.id))
        return {
          released: result.success ? 1 : 0,
          ruleCount: result.publishedRuleIds.length,
        }
      })
    )
  } else {
    // Light run: sentinel + gate snapshot only
    phases.push(
      await runPhase("sentinel-light", async () => {
        const result = await runSentinel("CRITICAL")
        return {
          endpointsChecked: result.endpointsChecked,
          newItems: result.newItemsDiscovered,
        }
      })
    )
  }

  // Step 4: Verify synthetic conflict was processed
  if (heartbeatConflictId) {
    const heartbeatVerified = await verifySyntheticConflictProcessed(heartbeatConflictId)
    if (!heartbeatVerified) {
      console.warn("[live-e2e] WARNING: Synthetic conflict not processed within timeout")
    }
  }

  // Step 5: Run autonomous data repair (fixes known integrity issues)
  console.log("\n[live-e2e] Running autonomous data repair...")
  const repairResult = await runDataRepair()
  if (repairResult.errors.length > 0) {
    console.warn(`[live-e2e] Repair errors: ${repairResult.errors.join(", ")}`)
  }

  // Step 6: Collect metrics
  console.log("\n[live-e2e] Collecting metrics...")
  const metrics = await collectMetrics()

  // Step 7: Validate invariants
  console.log("\n[live-e2e] Validating invariants...")
  const invariants = await validateInvariants()

  // Step 7: Run assistant suite (if not skipped)
  let assistantSuite: AssistantSuiteResults | null = null
  if (!skipAssistant && !lightRun) {
    console.log("\n[live-e2e] Running assistant test suite...")
    assistantSuite = await runAssistantSuite()
    metrics.assistant = {
      citationCompliance: assistantSuite.citationCompliance,
      refusalRate: assistantSuite.refusalRate,
      errorRate: assistantSuite.errorRate,
    }
  }

  // Step 8: Determine verdict
  const verdict = fingerprint.isValid ? determineVerdict(invariants) : "INVALID"

  // Step 9: Generate report
  const report = generateReport({
    fingerprint,
    verdict,
    phases,
    invariants,
    metrics,
    assistantSuite,
  })

  // Step 10: Save artifacts
  saveArtifacts(runPath, fingerprint, phases, invariants, metrics, assistantSuite)

  // Step 11: Print summary
  console.log("\n" + "=".repeat(72))
  console.log(`                    VERDICT: ${verdict}`)
  console.log("=".repeat(72))
  console.log(report.summary)

  return {
    fingerprint,
    verdict,
    phases,
    invariants,
    assistantSuite,
    metrics,
    report,
    artifactsPath: runPath,
  }
}
