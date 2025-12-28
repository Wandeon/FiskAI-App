// src/lib/regulatory-truth/scripts/content-bridge.ts
// Content Bridge: Generates and sends Slack alerts for regulatory changes detected by Sentinel

import { config } from "dotenv"
import { readFileSync } from "fs"
import { parse } from "dotenv"

// Load environment variables BEFORE importing any modules that use them
config({ path: ".env.local" })

// Load .env for additional vars
try {
  const envContent = readFileSync(".env", "utf-8")
  const parsed = parse(envContent)
  // Use SLACK vars from .env if not already set
  if (parsed.SLACK_WEBHOOK_URL && !process.env.SLACK_WEBHOOK_URL) {
    process.env.SLACK_WEBHOOK_URL = parsed.SLACK_WEBHOOK_URL
  }
  if (parsed.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL) {
    process.env.NEXT_PUBLIC_APP_URL = parsed.NEXT_PUBLIC_APP_URL
  }
} catch {
  // .env may not exist
}

import { Pool } from "pg"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { getAffectedGuides } from "../concept-guide-map"
import { sendContentAlert, type ContentAlert } from "../watchdog/slack"

// Create pool and prisma instance
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

interface EvidenceWithRelations {
  id: string
  fetchedAt: Date
  hasChanged: boolean
  changeSummary: string | null
  sourcePointers: Array<{
    id: string
    domain: string
    lawReference: string | null
  }>
  source: {
    id: string
    name: string
  }
}

interface ConceptGroup {
  conceptId: string
  evidenceIds: string[]
  changeSummaries: string[]
  lawReferences: string[]
  providers: Set<string>
}

/**
 * Query Evidence records from the last 24 hours that have changes
 */
async function getRecentChangedEvidence(): Promise<EvidenceWithRelations[]> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const changedEvidence = await prisma.evidence.findMany({
    where: {
      fetchedAt: { gte: yesterday },
      hasChanged: true,
    },
    include: {
      sourcePointers: {
        select: {
          id: true,
          domain: true,
          lawReference: true,
        },
      },
      source: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    take: 100,
    orderBy: { fetchedAt: "desc" },
  })

  return changedEvidence
}

/**
 * Check if any rules for this concept have open conflicts
 */
async function hasOpenConflicts(conceptSlug: string): Promise<boolean> {
  const conflicts = await prisma.regulatoryConflict.count({
    where: {
      status: "OPEN",
      OR: [{ itemA: { conceptSlug } }, { itemB: { conceptSlug } }],
    },
  })

  return conflicts > 0
}

/**
 * Check if any rules for this concept are effective soon (within 30 days)
 */
async function hasEffectiveSoonRules(conceptSlug: string): Promise<boolean> {
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const now = new Date()

  const upcomingRules = await prisma.regulatoryRule.count({
    where: {
      conceptSlug,
      effectiveFrom: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
      status: { in: ["APPROVED", "PUBLISHED"] },
    },
  })

  return upcomingRules > 0
}

/**
 * Check if concept touches published rules
 */
async function touchesPublishedRules(conceptSlug: string): Promise<boolean> {
  const publishedRules = await prisma.regulatoryRule.count({
    where: {
      conceptSlug,
      status: "PUBLISHED",
    },
  })

  return publishedRules > 0
}

/**
 * Group evidence by concept (domain field in sourcePointers)
 */
function groupByConcept(evidence: EvidenceWithRelations[]): Map<string, ConceptGroup> {
  const groups = new Map<string, ConceptGroup>()

  for (const ev of evidence) {
    for (const pointer of ev.sourcePointers) {
      const conceptId = pointer.domain
      if (!conceptId) continue

      if (!groups.has(conceptId)) {
        groups.set(conceptId, {
          conceptId,
          evidenceIds: [],
          changeSummaries: [],
          lawReferences: [],
          providers: new Set(),
        })
      }

      const group = groups.get(conceptId)!
      if (!group.evidenceIds.includes(ev.id)) {
        group.evidenceIds.push(ev.id)
        if (ev.changeSummary) {
          group.changeSummaries.push(ev.changeSummary)
        }
      }
      if (pointer.lawReference && !group.lawReferences.includes(pointer.lawReference)) {
        group.lawReferences.push(pointer.lawReference)
      }
      group.providers.add(ev.source.name)
    }
  }

  return groups
}

/**
 * Determine severity based on concept state
 */
async function computeSeverity(conceptId: string): Promise<"critical" | "major" | "info"> {
  // Critical if effectiveSoon or has conflicts
  const [hasConflicts, isEffectiveSoon] = await Promise.all([
    hasOpenConflicts(conceptId),
    hasEffectiveSoonRules(conceptId),
  ])

  if (hasConflicts || isEffectiveSoon) {
    return "critical"
  }

  // Major if touches published rules
  const touchesPublished = await touchesPublishedRules(conceptId)
  if (touchesPublished) {
    return "major"
  }

  return "info"
}

/**
 * Generate a summary from change summaries and law references
 */
function generateSummary(group: ConceptGroup): string {
  const parts: string[] = []

  if (group.changeSummaries.length > 0) {
    // Use the first change summary, truncated
    const firstSummary = group.changeSummaries[0]
    parts.push(firstSummary.length > 200 ? firstSummary.slice(0, 200) + "..." : firstSummary)
  }

  if (group.lawReferences.length > 0) {
    parts.push(`Sources: ${group.lawReferences.slice(0, 3).join(", ")}`)
  }

  parts.push(`Providers: ${Array.from(group.providers).join(", ")}`)

  return parts.join("\n") || "Regulatory content changed"
}

/**
 * Generate ContentAlert objects from grouped evidence
 */
export async function generateContentAlerts(): Promise<ContentAlert[]> {
  console.log("[content-bridge] Querying recent changed evidence...")
  const evidence = await getRecentChangedEvidence()
  console.log(`[content-bridge] Found ${evidence.length} evidence records with changes`)

  if (evidence.length === 0) {
    return []
  }

  console.log("[content-bridge] Grouping by concept...")
  const groups = groupByConcept(evidence)
  console.log(`[content-bridge] Found ${groups.size} concepts with changes`)

  const alerts: ContentAlert[] = []
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

  for (const [conceptId, group] of groups) {
    console.log(`[content-bridge] Processing concept: ${conceptId}`)

    const affectedGuides = getAffectedGuides(conceptId)
    const severity = await computeSeverity(conceptId)
    const summary = generateSummary(group)

    const alert: ContentAlert = {
      conceptId,
      affectedGuides,
      changesDetected: group.evidenceIds.length,
      severity,
      evidenceIds: group.evidenceIds,
      summary,
      deepLinks: {
        evidence: group.evidenceIds.map((id) => `${origin}/admin/regulatory/evidence/${id}`),
        guides: affectedGuides.map((slug) => `${origin}/vodic/${slug}`),
      },
    }

    alerts.push(alert)
  }

  // Sort by severity (critical first, then major, then info)
  const severityOrder = { critical: 0, major: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return alerts
}

/**
 * Run the content bridge: generate alerts and send to Slack
 */
export async function runContentBridge(): Promise<{ success: boolean; alertCount: number }> {
  try {
    console.log("[content-bridge] Starting content bridge...")
    const alerts = await generateContentAlerts()

    if (alerts.length === 0) {
      console.log("[content-bridge] No alerts to send")
      return { success: true, alertCount: 0 }
    }

    console.log(`[content-bridge] Sending ${alerts.length} alerts to Slack...`)

    let successCount = 0
    for (const alert of alerts) {
      const sent = await sendContentAlert(alert)
      if (sent) {
        successCount++
        console.log(`[content-bridge] Sent alert for ${alert.conceptId} (${alert.severity})`)
      } else {
        console.warn(`[content-bridge] Failed to send alert for ${alert.conceptId}`)
      }
    }

    console.log(`[content-bridge] Complete. Sent ${successCount}/${alerts.length} alerts`)

    return {
      success: successCount === alerts.length,
      alertCount: successCount,
    }
  } catch (error) {
    console.error("[content-bridge] Error:", error)
    return { success: false, alertCount: 0 }
  }
}

/**
 * Cleanup database connections
 */
async function cleanup(): Promise<void> {
  await prisma.$disconnect()
  await pool.end()
}

// CLI entry point
if (require.main === module) {
  runContentBridge()
    .then(async (result) => {
      console.log(result)
      await cleanup()
      process.exit(result.success ? 0 : 1)
    })
    .catch(async (err) => {
      console.error(err)
      await cleanup()
      process.exit(1)
    })
}
