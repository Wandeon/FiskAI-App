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

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const RATE_LIMIT_DELAY = 60000 // 60 seconds between LLM calls

async function sleep(ms: number) {
  console.log(`[overnight] Waiting ${ms / 1000}s for rate limit...`)
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const { runExtractor } = await import("../agents/extractor")
  const { runComposer, groupSourcePointersByDomain } = await import("../agents/composer")
  const { runReviewer } = await import("../agents/reviewer")
  const { runReleaser } = await import("../agents/releaser")

  const client = await pool.connect()

  console.log("\n=== OVERNIGHT REGULATORY TRUTH PIPELINE ===")
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log(`Rate limit delay: ${RATE_LIMIT_DELAY / 1000}s between calls\n`)

  try {
    // Phase 1: Extract from unprocessed evidence
    console.log("=== PHASE 1: EXTRACTION ===")
    const unprocessedEvidence = await client.query(
      `SELECT e.id, s.slug, s.name
       FROM "Evidence" e
       JOIN "RegulatorySource" s ON e."sourceId" = s.id
       WHERE NOT EXISTS (
         SELECT 1 FROM "SourcePointer" sp WHERE sp."evidenceId" = e.id
       )
       ORDER BY s."riskTier" DESC
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
       ORDER BY "riskTier" DESC
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
            console.log(`[review] ✓ Decision: ${result.decision}`)
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

    // Phase 4: Release approved rules
    console.log("\n=== PHASE 4: RELEASE ===")
    const approvedRules = await client.query(
      `SELECT id, "conceptSlug"
       FROM "RegulatoryRule"
       WHERE status = 'APPROVED'
       AND "releaseId" IS NULL
       LIMIT 20`
    )

    if (approvedRules.rows.length > 0) {
      console.log(`Found ${approvedRules.rows.length} approved rules ready for release`)

      try {
        const result = await runReleaser(approvedRules.rows.map((r) => r.id))
        if (result.success) {
          console.log(`[release] ✓ Created release: ${result.releaseId} (v${result.version})`)
        } else {
          console.log(`[release] ✗ ${result.error}`)
        }
      } catch (error) {
        console.error(`[release] ✗ ${error}`)
      }
    } else {
      console.log("No approved rules to release")
    }

    // Final status
    console.log("\n=== FINAL STATUS ===")
    const status = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM "RegulatorySource" WHERE "isActive" = true) as sources,
        (SELECT COUNT(*) FROM "Evidence") as evidence,
        (SELECT COUNT(*) FROM "SourcePointer") as pointers,
        (SELECT COUNT(*) FROM "RegulatoryRule" WHERE status = 'DRAFT') as draft_rules,
        (SELECT COUNT(*) FROM "RegulatoryRule" WHERE status = 'APPROVED') as approved_rules,
        (SELECT COUNT(*) FROM "RegulatoryRule" WHERE status = 'ACTIVE') as active_rules,
        (SELECT COUNT(*) FROM "RegulatoryRelease") as releases
    `)

    const s = status.rows[0]
    console.log(`Active Sources: ${s.sources}`)
    console.log(`Evidence Records: ${s.evidence}`)
    console.log(`Source Pointers: ${s.pointers}`)
    console.log(`Draft Rules: ${s.draft_rules}`)
    console.log(`Approved Rules: ${s.approved_rules}`)
    console.log(`Active Rules: ${s.active_rules}`)
    console.log(`Releases: ${s.releases}`)
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
