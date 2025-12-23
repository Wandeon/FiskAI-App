// src/lib/regulatory-truth/e2e/synthetic-heartbeat.ts
// Creates synthetic conflicts to verify Arbiter pipeline health

import { db } from "@/lib/db"
import { createId } from "@paralleldrive/cuid2"

const HEARTBEAT_PREFIX = "heartbeat-synthetic-"
const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Create a synthetic conflict to verify the Arbiter processes correctly.
 * This conflict intentionally has equal evidence and should result in ESCALATION.
 */
export async function createSyntheticConflict(): Promise<string | null> {
  const timestamp = Date.now()
  const conflictId = `${HEARTBEAT_PREFIX}${timestamp}`

  try {
    console.log(`[heartbeat] Creating synthetic conflict: ${conflictId}`)

    // First, check if we have any evidence to reference
    const evidenceRecords = await db.evidence.findMany({
      take: 2,
      orderBy: { fetchedAt: "desc" },
    })

    if (evidenceRecords.length < 2) {
      console.warn("[heartbeat] Not enough evidence records for synthetic conflict")
      return null
    }

    // Create two synthetic source pointers with conflicting values
    const pointer1 = await db.sourcePointer.create({
      data: {
        id: createId(),
        evidenceId: evidenceRecords[0].id,
        domain: "heartbeat",
        valueType: "text",
        extractedValue: "100",
        displayValue: "100",
        exactQuote: "[SYNTHETIC HEARTBEAT TEST - VALUE A]",
        confidence: 0.95,
      },
    })

    const pointer2 = await db.sourcePointer.create({
      data: {
        id: createId(),
        evidenceId: evidenceRecords[1].id,
        domain: "heartbeat",
        valueType: "text",
        extractedValue: "200",
        displayValue: "200",
        exactQuote: "[SYNTHETIC HEARTBEAT TEST - VALUE B]",
        confidence: 0.95,
      },
    })

    // Create the synthetic conflict
    await db.regulatoryConflict.create({
      data: {
        id: conflictId,
        conflictType: "SOURCE_CONFLICT",
        status: "OPEN",
        description: `[SYNTHETIC HEARTBEAT] Conflicting values for test field: ${pointer1.extractedValue} vs ${pointer2.extractedValue}`,
        metadata: {
          type: "HEARTBEAT_TEST",
          createdAt: new Date().toISOString(),
          expectedResolution: "ESCALATE_TO_HUMAN",
          candidatePointerIds: [pointer1.id, pointer2.id],
        },
      },
    })

    console.log(
      `[heartbeat] Created synthetic conflict with pointers: ${pointer1.id}, ${pointer2.id}`
    )
    return conflictId
  } catch (error) {
    console.error("[heartbeat] Failed to create synthetic conflict:", error)
    return null
  }
}

/**
 * Verify that a synthetic conflict was processed within timeout.
 * Expected: Either ESCALATED (correct) or RESOLVED with evidence (acceptable)
 */
export async function verifySyntheticConflictProcessed(
  conflictId: string,
  timeoutMs: number = HEARTBEAT_TIMEOUT_MS
): Promise<boolean> {
  console.log(`[heartbeat] Verifying synthetic conflict: ${conflictId}`)

  const startTime = Date.now()
  const checkInterval = 10000 // Check every 10 seconds

  while (Date.now() - startTime < timeoutMs) {
    const conflict = await db.regulatoryConflict.findUnique({
      where: { id: conflictId },
    })

    if (!conflict) {
      console.error(`[heartbeat] Conflict ${conflictId} not found!`)
      return false
    }

    if (conflict.status === "ESCALATED") {
      console.log(`[heartbeat] ✓ Synthetic conflict correctly ESCALATED`)
      return true
    }

    if (conflict.status === "RESOLVED") {
      // Check resolution JSON for evidence
      const resolution = conflict.resolution as Record<string, unknown> | null
      if (resolution && resolution.winningItemId) {
        console.log(`[heartbeat] ✓ Synthetic conflict RESOLVED with evidence`)
        return true
      } else {
        console.warn(`[heartbeat] ✗ Synthetic conflict RESOLVED without evidence!`)
        return false
      }
    }

    // Still OPEN, wait and check again
    await new Promise((resolve) => setTimeout(resolve, checkInterval))
  }

  console.warn(`[heartbeat] Synthetic conflict still OPEN after ${timeoutMs}ms timeout`)
  return false
}

/**
 * Clean up old synthetic heartbeat conflicts (older than 24 hours)
 */
export async function cleanupOldHeartbeatConflicts(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Find heartbeat conflicts
  const heartbeatConflicts = await db.regulatoryConflict.findMany({
    where: {
      id: { startsWith: HEARTBEAT_PREFIX },
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  })

  if (heartbeatConflicts.length === 0) {
    return 0
  }

  // Delete associated source pointers first
  await db.sourcePointer.deleteMany({
    where: {
      domain: "heartbeat",
      valueType: "text",
      createdAt: { lt: cutoff },
    },
  })

  // Delete the conflicts
  const deleted = await db.regulatoryConflict.deleteMany({
    where: {
      id: { in: heartbeatConflicts.map((c) => c.id) },
    },
  })

  console.log(`[heartbeat] Cleaned up ${deleted.count} old heartbeat conflicts`)
  return deleted.count
}

/**
 * Check if the Arbiter pipeline is healthy based on recent heartbeat results
 */
export async function checkHeartbeatHealth(): Promise<{
  healthy: boolean
  lastHeartbeat: Date | null
  recentResults: { escalated: number; resolved: number; failed: number }
}> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const recentHeartbeats = await db.regulatoryConflict.findMany({
    where: {
      id: { startsWith: HEARTBEAT_PREFIX },
      createdAt: { gte: oneDayAgo },
    },
    orderBy: { createdAt: "desc" },
  })

  const escalated = recentHeartbeats.filter((c) => c.status === "ESCALATED").length
  const resolved = recentHeartbeats.filter((c) => c.status === "RESOLVED").length
  const failed = recentHeartbeats.filter((c) => c.status === "OPEN").length

  // Healthy if any heartbeat was processed (escalated or resolved)
  const healthy = escalated + resolved > 0 || recentHeartbeats.length === 0

  return {
    healthy,
    lastHeartbeat: recentHeartbeats[0]?.createdAt || null,
    recentResults: { escalated, resolved, failed },
  }
}
