// src/lib/regulatory-truth/watchdog/progress-gates.ts
//
// Progress Gate Health Checks
// Detects pipeline stage stalls where items are stuck between stages.
//
// Gate 1: Evidence created > X hours ago with no SourcePointers
// Gate 2: SourcePointers created > X hours ago with no Rules
// Gate 3: Rules APPROVED > X hours ago with no releases

// NOTE: db import needed for SourcePointer and RegulatoryRule queries
// (these models still in core schema pending batch 2+ migration)
// eslint-disable-next-line no-restricted-imports
import { db, dbReg } from "@/lib/db"
import type { WatchdogHealthStatus, WatchdogCheckType, WatchdogAlertType } from "@prisma/client"
import { raiseAlert } from "./alerting"
import type { HealthCheckResult } from "./types"

// Thresholds (in hours)
const EVIDENCE_STALL_HOURS = 4
const EXTRACTION_STALL_HOURS = 6
const RELEASE_STALL_HOURS = 24

// Count thresholds for severity levels
const STALL_COUNT_WARNING = 5
const STALL_COUNT_CRITICAL = 20

export interface ProgressGateResult {
  gate: string
  status: WatchdogHealthStatus
  stalledCount: number
  oldestAgeHours: number | null
  topStalled: string[]
}

/**
 * Determine health status based on stalled count
 */
function determineStatus(stalledCount: number): WatchdogHealthStatus {
  if (stalledCount >= STALL_COUNT_CRITICAL) return "CRITICAL"
  if (stalledCount >= STALL_COUNT_WARNING) return "WARNING"
  if (stalledCount > 0) return "WARNING"
  return "HEALTHY"
}

/**
 * Gate 1: Evidence created > X hours ago with no SourcePointers
 *
 * Detects when discovery succeeded but extraction didn't run.
 */
export async function checkEvidenceProgressGate(): Promise<ProgressGateResult> {
  const cutoff = new Date(Date.now() - EVIDENCE_STALL_HOURS * 60 * 60 * 1000)

  // Find evidence IDs that have source pointers
  const evidenceWithPointers = await db.sourcePointer.findMany({
    select: { evidenceId: true },
    distinct: ["evidenceId"],
  })
  const processedIds = evidenceWithPointers.map((p) => p.evidenceId)

  // Find evidence without pointers, older than threshold
  const stalledEvidence = await dbReg.evidence.findMany({
    where: {
      id: processedIds.length > 0 ? { notIn: processedIds } : undefined,
      fetchedAt: { lt: cutoff },
    },
    orderBy: { fetchedAt: "asc" },
    take: 50,
    select: { id: true, fetchedAt: true },
  })

  const stalledCount = stalledEvidence.length
  const oldestAgeHours = stalledEvidence[0]
    ? (Date.now() - stalledEvidence[0].fetchedAt.getTime()) / (1000 * 60 * 60)
    : null

  return {
    gate: "evidence-to-sourcepointer",
    status: determineStatus(stalledCount),
    stalledCount,
    oldestAgeHours: oldestAgeHours ? Math.round(oldestAgeHours * 10) / 10 : null,
    topStalled: stalledEvidence.slice(0, 5).map((e) => e.id),
  }
}

/**
 * Gate 2: SourcePointers created > X hours ago with no associated Rules
 *
 * Detects when extraction succeeded but composition didn't run.
 */
export async function checkExtractionProgressGate(): Promise<ProgressGateResult> {
  const cutoff = new Date(Date.now() - EXTRACTION_STALL_HOURS * 60 * 60 * 1000)

  const stalledPointers = await db.sourcePointer.findMany({
    where: {
      createdAt: { lt: cutoff },
      rules: { none: {} },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, createdAt: true },
  })

  const stalledCount = stalledPointers.length
  const oldestAgeHours = stalledPointers[0]
    ? (Date.now() - stalledPointers[0].createdAt.getTime()) / (1000 * 60 * 60)
    : null

  return {
    gate: "sourcepointer-to-rule",
    status: determineStatus(stalledCount),
    stalledCount,
    oldestAgeHours: oldestAgeHours ? Math.round(oldestAgeHours * 10) / 10 : null,
    topStalled: stalledPointers.slice(0, 5).map((p) => p.id),
  }
}

/**
 * Gate 3: Rules APPROVED > X hours ago, not released
 *
 * Detects when review succeeded but release didn't run.
 */
export async function checkReleaseProgressGate(): Promise<ProgressGateResult> {
  const cutoff = new Date(Date.now() - RELEASE_STALL_HOURS * 60 * 60 * 1000)

  const stalledRules = await db.regulatoryRule.findMany({
    where: {
      status: "APPROVED",
      updatedAt: { lt: cutoff },
      releases: { none: {} },
    },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: { id: true, updatedAt: true },
  })

  const stalledCount = stalledRules.length
  const oldestAgeHours = stalledRules[0]
    ? (Date.now() - stalledRules[0].updatedAt.getTime()) / (1000 * 60 * 60)
    : null

  return {
    gate: "approved-to-published",
    status: determineStatus(stalledCount),
    stalledCount,
    oldestAgeHours: oldestAgeHours ? Math.round(oldestAgeHours * 10) / 10 : null,
    topStalled: stalledRules.slice(0, 5).map((r) => r.id),
  }
}

/**
 * Run all progress gate checks
 *
 * Returns HealthCheckResult array for each gate.
 * Raises alerts for any unhealthy gates.
 */
export async function runProgressGateChecks(): Promise<HealthCheckResult[]> {
  const results: HealthCheckResult[] = []

  const gates = await Promise.all([
    checkEvidenceProgressGate(),
    checkExtractionProgressGate(),
    checkReleaseProgressGate(),
  ])

  const gateToCheckType: Record<string, WatchdogCheckType> = {
    "evidence-to-sourcepointer": "PROGRESS_GATE_EVIDENCE",
    "sourcepointer-to-rule": "PROGRESS_GATE_EXTRACTION",
    "approved-to-published": "PROGRESS_GATE_RELEASE",
  }

  const gateToAlertType: Record<string, WatchdogAlertType> = {
    "evidence-to-sourcepointer": "PROGRESS_STALL_EVIDENCE",
    "sourcepointer-to-rule": "PROGRESS_STALL_EXTRACTION",
    "approved-to-published": "PROGRESS_STALL_RELEASE",
  }

  for (const gate of gates) {
    if (gate.status !== "HEALTHY") {
      await raiseAlert({
        severity: gate.status === "CRITICAL" ? "CRITICAL" : "WARNING",
        type: gateToAlertType[gate.gate],
        entityId: gate.gate,
        message: `Pipeline stall: ${gate.stalledCount} items stuck at ${gate.gate} (oldest: ${gate.oldestAgeHours}h)`,
        details: {
          gate: gate.gate,
          stalledCount: gate.stalledCount,
          oldestAgeHours: gate.oldestAgeHours,
          topStalled: gate.topStalled,
        },
      })
    }

    results.push({
      checkType: gateToCheckType[gate.gate],
      entityId: gate.gate,
      status: gate.status,
      metric: gate.stalledCount,
      message: `${gate.stalledCount} stalled (oldest: ${gate.oldestAgeHours ?? 0}h)`,
    })
  }

  return results
}
