// src/lib/regulatory-truth/scripts/overnight-run.ts
// Overnight runner for full regulatory truth pipeline with generous rate limiting

import { config } from "dotenv"
import { readFileSync } from "fs"
import { parse } from "dotenv"

// Load environment variables
config({ path: ".env.local" })

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

// Use DATABASE_URL from env, or fallback to local connection
// Docker network uses fiskai-postgres hostname, but local dev uses localhost:5434
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL || ""

  // If running outside Docker and URL uses Docker hostname, convert to localhost
  if (url.includes("fiskai-postgres") && !process.env.DOCKER_CONTAINER) {
    return url.replace("fiskai-postgres:5432", "localhost:5434")
  }

  return url
}

const pool = new Pool({ connectionString: getDatabaseUrl() })
const RATE_LIMIT_DELAY = parseInt(process.env.AGENT_RATE_LIMIT_MS || "3000") // 3 seconds

async function sleep(ms: number) {
  console.log(`[overnight] Waiting ${ms / 1000}s for rate limit...`)
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export async function main() {
  const { runSentinel, fetchDiscoveredItems } = await import("../agents/sentinel")
  const { runExtractor } = await import("../agents/extractor")
  const { runComposer, groupSourcePointersByDomain } = await import("../agents/composer")
  const { runReviewer, autoApproveEligibleRules } = await import("../agents/reviewer")
  const { runArbiter } = await import("../agents/arbiter")
  const { runReleaser } = await import("../agents/releaser")
  const { runTier1Fetchers } = await import("../fetchers")
  // NOTE: buildKnowledgeGraph removed - edges are now built event-driven on publish
  // See rule-status-service.ts:publishRules() → rebuildEdgesForRule()

  const client = await pool.connect()

  console.log("\n=== OVERNIGHT REGULATORY TRUTH PIPELINE ===")
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log(`Rate limit delay: ${RATE_LIMIT_DELAY / 1000}s between calls\n`)

  try {
    // Phase -1: Tier 1 Structured Fetchers (100% reliable, no AI)
    console.log("=== PHASE -1: TIER 1 STRUCTURED DATA ===")
    console.log("Fetching structured data from official APIs (bypasses AI)...")
    try {
      const tier1Result = await runTier1Fetchers()
      console.log(`[tier1] HNB: ${tier1Result.hnb.ratesCreated} exchange rate rules created`)
      console.log(`[tier1] NN: ${tier1Result.nn.evidenceCreated} legal metadata records created`)
      console.log(
        `[tier1] EUR-Lex: ${tier1Result.eurlex.evidenceCreated} EU legislation records created`
      )
      console.log(`[tier1] Total duration: ${tier1Result.durationMs}ms`)
      if (tier1Result.hnb.error) console.log(`[tier1] HNB warning: ${tier1Result.hnb.error}`)
      if (tier1Result.nn.error) console.log(`[tier1] NN warning: ${tier1Result.nn.error}`)
      if (tier1Result.eurlex.error)
        console.log(`[tier1] EUR-Lex warning: ${tier1Result.eurlex.error}`)
    } catch (error) {
      console.error("[tier1] Error in Tier 1 fetchers:", error)
    }
    console.log("\n[tier1] Complete")
    await sleep(RATE_LIMIT_DELAY)

    // Phase 0: Discovery (Sentinel)
    console.log("=== PHASE 0: DISCOVERY ===")

    // Run Sentinel for CRITICAL endpoints
    const criticalResult = await runSentinel("CRITICAL")
    console.log(
      `[sentinel] CRITICAL: ${criticalResult.endpointsChecked} checked, ${criticalResult.newItemsDiscovered} discovered`
    )

    // Run Sentinel for HIGH priority endpoints
    const highResult = await runSentinel("HIGH")
    console.log(
      `[sentinel] HIGH: ${highResult.endpointsChecked} checked, ${highResult.newItemsDiscovered} discovered`
    )

    // Fetch discovered items (up to 100)
    const fetchResult = await fetchDiscoveredItems(100)
    console.log(`[sentinel] Fetch: ${fetchResult.fetched} fetched, ${fetchResult.failed} failed`)

    console.log("\n[discovery] Complete")
    await sleep(RATE_LIMIT_DELAY)

    // Phase 1: Extract from unprocessed evidence
    console.log("=== PHASE 1: EXTRACTION ===")
    const unprocessedEvidence = await client.query(
      `SELECT e.id, s.slug, s.name
       FROM "Evidence" e
       JOIN "RegulatorySource" s ON e."sourceId" = s.id
       WHERE NOT EXISTS (
         SELECT 1 FROM "SourcePointer" sp WHERE sp."evidenceId" = e.id
       )
       ORDER BY s.hierarchy ASC
       LIMIT 10`
    )

    console.log(`Found ${unprocessedEvidence.rows.length} unprocessed evidence records`)

    let extractSuccess = 0
    let extractFailed = 0

    for (const evidence of unprocessedEvidence.rows) {
      console.log(`\n[extract] Processing: ${evidence.slug}`)
      try {
        const result = await runExtractor(evidence.id)
        if (result.success) {
          extractSuccess++
          console.log(`[extract] ✓ Extracted ${result.sourcePointerIds.length} pointers`)
        } else {
          extractFailed++
          console.log(`[extract] ✗ ${result.error}`)
        }
      } catch (error) {
        extractFailed++
        console.error(`[extract] ✗ ${error}`)
      }
      await sleep(RATE_LIMIT_DELAY)
    }

    console.log(`\n[extract] Complete: ${extractSuccess} success, ${extractFailed} failed`)

    // Phase 2: Compose rules from ungrouped pointers
    console.log("\n=== PHASE 2: COMPOSITION ===")
    const ungroupedPointers = await client.query(
      `SELECT sp.id, sp.domain
       FROM "SourcePointer" sp
       WHERE NOT EXISTS (
         SELECT 1 FROM "_RuleSourcePointers" rsp WHERE rsp."B" = sp.id
       )`
    )

    if (ungroupedPointers.rows.length > 0) {
      const grouped = groupSourcePointersByDomain(ungroupedPointers.rows)
      console.log(
        `Found ${ungroupedPointers.rows.length} ungrouped pointers across ${Object.keys(grouped).length} domains`
      )

      let composeSuccess = 0
      let composeFailed = 0

      for (const [domain, pointerIds] of Object.entries(grouped)) {
        console.log(`\n[compose] Processing domain: ${domain} (${pointerIds.length} pointers)`)
        try {
          const result = await runComposer(pointerIds)
          if (result.success && result.ruleId) {
            composeSuccess++
            console.log(`[compose] ✓ Created rule: ${result.ruleId}`)
          } else {
            composeFailed++
            console.log(`[compose] ✗ ${result.error}`)
          }
        } catch (error) {
          composeFailed++
          console.error(`[compose] ✗ ${error}`)
        }
        await sleep(RATE_LIMIT_DELAY)
      }

      console.log(`\n[compose] Complete: ${composeSuccess} success, ${composeFailed} failed`)
    } else {
      console.log("No ungrouped pointers to process")
    }

    // Phase 3: Review pending rules
    console.log("\n=== PHASE 3: REVIEW ===")
    const pendingRules = await client.query(
      `SELECT id, "conceptSlug", "riskTier"
       FROM "RegulatoryRule"
       WHERE status = 'DRAFT'
       ORDER BY "conceptSlug" ASC
       LIMIT 10`
    )

    if (pendingRules.rows.length > 0) {
      console.log(`Found ${pendingRules.rows.length} pending rules to review`)

      let reviewSuccess = 0
      let reviewFailed = 0

      for (const rule of pendingRules.rows) {
        console.log(`\n[review] Processing: ${rule.conceptSlug} (${rule.riskTier})`)
        try {
          const result = await runReviewer(rule.id)
          if (result.success) {
            reviewSuccess++
            console.log(
              `[review] ✓ Decision: ${result.output?.review_result?.decision || "completed"}`
            )
          } else {
            reviewFailed++
            console.log(`[review] ✗ ${result.error}`)
          }
        } catch (error) {
          reviewFailed++
          console.error(`[review] ✗ ${error}`)
        }
        await sleep(RATE_LIMIT_DELAY)
      }

      console.log(`\n[review] Complete: ${reviewSuccess} success, ${reviewFailed} failed`)
    } else {
      console.log("No pending rules to review")
    }

    // Phase 3.5: Auto-approve eligible PENDING_REVIEW rules
    console.log("\n=== PHASE 3.5: AUTO-APPROVAL ===")
    try {
      const autoApproveResult = await autoApproveEligibleRules()
      console.log(
        `[auto-approve] ${autoApproveResult.approved} approved, ${autoApproveResult.skipped} skipped`
      )
      if (autoApproveResult.errors.length > 0) {
        console.log(`[auto-approve] Errors: ${autoApproveResult.errors.join(", ")}`)
      }
    } catch (error) {
      console.error("[auto-approve] Error:", error)
    }
    await sleep(RATE_LIMIT_DELAY)

    // Phase 3.6: Resolve open conflicts
    console.log("\n=== PHASE 3.6: CONFLICT RESOLUTION ===")
    const openConflicts = await client.query(
      `SELECT id, "conflictType", description
       FROM "RegulatoryConflict"
       WHERE status = 'OPEN'
       LIMIT 5`
    )

    if (openConflicts.rows.length > 0) {
      console.log(`Found ${openConflicts.rows.length} open conflicts to resolve`)

      let arbiterSuccess = 0
      let arbiterFailed = 0

      for (const conflict of openConflicts.rows) {
        console.log(`\n[arbiter] Processing: ${conflict.conflictType} (${conflict.id})`)
        try {
          const result = await runArbiter(conflict.id)
          if (result.success) {
            arbiterSuccess++
            console.log(`[arbiter] ✓ Resolution: ${result.resolution}`)
          } else {
            arbiterFailed++
            console.log(`[arbiter] ✗ ${result.error}`)
          }
        } catch (error) {
          arbiterFailed++
          console.error(`[arbiter] ✗ ${error}`)
        }
        await sleep(RATE_LIMIT_DELAY)
      }

      console.log(`\n[arbiter] Complete: ${arbiterSuccess} success, ${arbiterFailed} failed`)
    } else {
      console.log("No open conflicts to resolve")
    }

    // Phase 4: Release approved rules
    console.log("\n=== PHASE 4: RELEASE ===")
    const approvedRules = await client.query(
      `SELECT r.id, r."conceptSlug"
       FROM "RegulatoryRule" r
       WHERE r.status = 'APPROVED'
       AND NOT EXISTS (
         SELECT 1 FROM "_ReleaseRules" rr WHERE rr."A" = r.id
       )
       LIMIT 20`
    )

    if (approvedRules.rows.length > 0) {
      console.log(`Found ${approvedRules.rows.length} approved rules ready for release`)

      try {
        const result = await runReleaser(approvedRules.rows.map((r) => r.id))
        if (result.success) {
          console.log(
            `[release] ✓ Created release: ${result.releaseId} (v${result.output?.release?.version || "new"})`
          )
        } else {
          console.log(`[release] ✗ ${result.error}`)
        }
      } catch (error) {
        console.error(`[release] ✗ ${error}`)
      }
    } else {
      console.log("No approved rules to release")
    }

    // Phase 5: Knowledge Graph
    // NOTE (2026-01-20): Batch edge building removed.
    // Edges are now built event-driven when rules transition to PUBLISHED.
    // See rule-status-service.ts:publishRules() → rebuildEdgesForRule()
    // The buildKnowledgeGraph() function still exists for manual repair if needed.
    console.log("\n=== PHASE 5: KNOWLEDGE GRAPH ===")
    console.log("[graph] Skipped - edges are built event-driven on publish")

    // Final status
    console.log("\n=== FINAL STATUS ===")
    const status = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM "RegulatorySource" WHERE "isActive" = true) as sources,
        (SELECT COUNT(*) FROM "Evidence") as evidence,
        (SELECT COUNT(*) FROM "SourcePointer") as pointers,
        (SELECT COUNT(*) FROM "RegulatoryRule" WHERE status = 'DRAFT') as draft_rules,
        (SELECT COUNT(*) FROM "RegulatoryRule" WHERE status = 'PENDING_REVIEW') as pending_rules,
        (SELECT COUNT(*) FROM "RegulatoryRule" WHERE status = 'APPROVED') as approved_rules,
        (SELECT COUNT(*) FROM "RegulatoryRule" WHERE status = 'PUBLISHED') as published_rules,
        (SELECT COUNT(*) FROM "RuleRelease") as releases,
        (SELECT COUNT(*) FROM "Concept") as concepts,
        (SELECT COUNT(*) FROM "GraphEdge") as graph_edges
    `)

    const s = status.rows[0]
    console.log(`Active Sources: ${s.sources}`)
    console.log(`Evidence Records: ${s.evidence}`)
    console.log(`Source Pointers: ${s.pointers}`)
    console.log(`Draft Rules: ${s.draft_rules}`)
    console.log(`Pending Review Rules: ${s.pending_rules}`)
    console.log(`Approved Rules: ${s.approved_rules}`)
    console.log(`Published Rules: ${s.published_rules}`)
    console.log(`Releases: ${s.releases}`)
    console.log(`Concepts: ${s.concepts}`)
    console.log(`Graph Edges: ${s.graph_edges}`)
    console.log(`\nCompleted at: ${new Date().toISOString()}`)
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(async (error) => {
  console.error("[overnight] Fatal error:", error)
  await pool.end()
  process.exit(1)
})
