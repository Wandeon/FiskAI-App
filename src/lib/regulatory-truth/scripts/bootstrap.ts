// src/lib/regulatory-truth/scripts/bootstrap.ts

import { config } from "dotenv"
import { readFileSync } from "fs"
import { parse } from "dotenv"

// Load environment variables BEFORE importing any modules that use them
// .env.local has DATABASE_URL for local dev, .env has working OLLAMA keys
config({ path: ".env.local" })

// Load .env but only use OLLAMA vars (the API key in .env works)
try {
  const envContent = readFileSync(".env", "utf-8")
  const parsed = parse(envContent)
  // Override only OLLAMA vars from .env
  if (parsed.OLLAMA_API_KEY) process.env.OLLAMA_API_KEY = parsed.OLLAMA_API_KEY
  if (parsed.OLLAMA_ENDPOINT) process.env.OLLAMA_ENDPOINT = parsed.OLLAMA_ENDPOINT
  if (parsed.OLLAMA_MODEL) process.env.OLLAMA_MODEL = parsed.OLLAMA_MODEL
} catch {
  // .env may not exist
}

import { Pool } from "pg"
import { seedRegulatorySources } from "./seed-sources"
import { getCriticalSources } from "../data/sources"

// Create pool for direct SQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

interface BootstrapResult {
  phase: string
  sourcesSeeded: number
  evidenceCollected: number
  sourcePointersCreated: number
  rulesCreated: number
  rulesApproved: number
  rulesPublished: number
  releaseId: string | null
  errors: string[]
}

/**
 * Full bootstrap process for Regulatory Truth Layer
 */
export async function bootstrap(): Promise<BootstrapResult> {
  // Dynamic imports after env is loaded (these modules use db which needs env)
  const { runSentinel } = await import("../agents/sentinel")
  const { runExtractor } = await import("../agents/extractor")
  const { runComposerBatch } = await import("../agents/composer")
  const { runReviewer } = await import("../agents/reviewer")
  const { runReleaser } = await import("../agents/releaser")

  const result: BootstrapResult = {
    phase: "bootstrap",
    sourcesSeeded: 0,
    evidenceCollected: 0,
    sourcePointersCreated: 0,
    rulesCreated: 0,
    rulesApproved: 0,
    rulesPublished: 0,
    releaseId: null,
    errors: [],
  }

  console.log("=".repeat(60))
  console.log("REGULATORY TRUTH LAYER - BOOTSTRAP")
  console.log("=".repeat(60))

  // Phase 1: Seed sources
  console.log("\n[Phase 1] Seeding regulatory sources...")
  try {
    const seedResult = await seedRegulatorySources()
    result.sourcesSeeded = seedResult.created
    result.errors.push(...seedResult.errors)
    console.log(`[Phase 1] Complete: ${seedResult.created} created, ${seedResult.skipped} skipped`)
  } catch (error) {
    result.errors.push(`Seed failed: ${error}`)
    console.error(`[Phase 1] Error: ${error}`)
  }

  // Phase 2 & 3: Collect evidence from critical sources and extract data points
  console.log("\n[Phase 2] Collecting evidence from critical sources...")
  const criticalSources = getCriticalSources()
  console.log(`[Phase 2] Found ${criticalSources.length} critical sources to process`)

  const client = await pool.connect()
  try {
    for (const sourceDef of criticalSources) {
      const sourceResult = await client.query(
        `SELECT id, slug, name FROM "RegulatorySource" WHERE slug = $1`,
        [sourceDef.slug]
      )

      if (sourceResult.rows.length === 0) {
        const msg = `Source not found in DB: ${sourceDef.slug}`
        console.log(`[bootstrap] ${msg}`)
        result.errors.push(msg)
        continue
      }

      const source = sourceResult.rows[0]
      console.log(`\n[bootstrap] Processing: ${source.name}`)

      try {
        // Phase 2: Run Sentinel to collect evidence
        console.log(`[bootstrap] Fetching evidence...`)
        const sentinelResult = await runSentinel(source.id)

        if (sentinelResult.success && sentinelResult.evidenceId) {
          result.evidenceCollected++
          console.log(`[bootstrap] ✓ Evidence collected: ${sentinelResult.evidenceId}`)

          // Phase 3: Extract data points
          console.log(`[bootstrap] Extracting data points...`)
          const extractorResult = await runExtractor(sentinelResult.evidenceId)

          if (extractorResult.success) {
            result.sourcePointersCreated += extractorResult.sourcePointerIds.length
            console.log(
              `[bootstrap] ✓ Extracted ${extractorResult.sourcePointerIds.length} data points`
            )
          } else {
            const msg = `Extraction failed for ${source.slug}: ${extractorResult.error}`
            result.errors.push(msg)
            console.log(`[bootstrap] ✗ ${msg}`)
          }
        } else {
          const msg = `Sentinel failed for ${source.slug}: ${sentinelResult.error}`
          result.errors.push(msg)
          console.log(`[bootstrap] ✗ ${msg}`)
        }
      } catch (error) {
        const msg = `Bootstrap failed for ${source.slug}: ${error}`
        result.errors.push(msg)
        console.error(`[bootstrap] ✗ ${msg}`)
      }

      // Rate limiting - 5 second delay between sources
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  } finally {
    client.release()
  }

  // Phase 4: Compose rules from source pointers
  console.log("\n[Phase 4] Composing rules from source pointers...")
  try {
    const composerResult = await runComposerBatch()
    result.rulesCreated = composerResult.totalRules
    result.errors.push(...composerResult.errors)
    console.log(
      `[Phase 4] Complete: ${composerResult.success} success, ${composerResult.failed} failed, ${composerResult.totalRules} rules created`
    )
  } catch (error) {
    result.errors.push(`Composer failed: ${error}`)
    console.error(`[Phase 4] Error: ${error}`)
  }

  // Phase 5: Review draft rules
  console.log("\n[Phase 5] Reviewing draft rules...")
  const client2 = await pool.connect()
  try {
    const draftRules = await client2.query(
      `SELECT id, "conceptSlug", "riskTier" FROM "RegulatoryRule" WHERE status = 'DRAFT' ORDER BY "createdAt" ASC LIMIT 50`
    )

    console.log(`[Phase 5] Found ${draftRules.rows.length} draft rules to review`)

    let reviewSuccess = 0
    let reviewFailed = 0
    const approvedRuleIds: string[] = []

    for (const rule of draftRules.rows) {
      console.log(`[bootstrap] Reviewing rule: ${rule.conceptSlug} (${rule.riskTier})`)

      try {
        const reviewerResult = await runReviewer(rule.id)

        if (reviewerResult.success) {
          reviewSuccess++

          // Check if rule was auto-approved (T2/T3 with high confidence)
          const updatedRule = await client2.query(
            `SELECT status FROM "RegulatoryRule" WHERE id = $1`,
            [rule.id]
          )

          if (updatedRule.rows[0]?.status === "APPROVED") {
            approvedRuleIds.push(rule.id)
            result.rulesApproved++
            console.log(`[bootstrap] ✓ Rule auto-approved: ${rule.conceptSlug}`)
          } else {
            console.log(`[bootstrap] ✓ Rule reviewed (pending human approval): ${rule.conceptSlug}`)
          }
        } else {
          reviewFailed++
          const msg = `Review failed for ${rule.conceptSlug}: ${reviewerResult.error}`
          result.errors.push(msg)
          console.log(`[bootstrap] ✗ ${msg}`)
        }
      } catch (error) {
        reviewFailed++
        const msg = `Review error for ${rule.conceptSlug}: ${error}`
        result.errors.push(msg)
        console.error(`[bootstrap] ✗ ${msg}`)
      }

      // Rate limiting - wait 3 seconds between reviews
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    console.log(
      `[Phase 5] Complete: ${reviewSuccess} reviewed, ${result.rulesApproved} auto-approved`
    )

    // Phase 6: Release approved rules
    if (approvedRuleIds.length > 0) {
      console.log(`\n[Phase 6] Releasing ${approvedRuleIds.length} approved rules...`)

      try {
        const releaserResult = await runReleaser(approvedRuleIds)

        if (releaserResult.success && releaserResult.releaseId) {
          result.releaseId = releaserResult.releaseId
          result.rulesPublished = releaserResult.publishedRuleIds.length
          console.log(
            `[Phase 6] ✓ Release created: ${releaserResult.releaseId} (${result.rulesPublished} rules published)`
          )
        } else {
          const msg = `Release failed: ${releaserResult.error}`
          result.errors.push(msg)
          console.log(`[Phase 6] ✗ ${msg}`)
        }
      } catch (error) {
        result.errors.push(`Releaser failed: ${error}`)
        console.error(`[Phase 6] Error: ${error}`)
      }
    } else {
      console.log("\n[Phase 6] Skipping release - no rules auto-approved")
    }
  } finally {
    client2.release()
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("BOOTSTRAP COMPLETE")
  console.log("=".repeat(60))
  console.log(`Sources seeded: ${result.sourcesSeeded}`)
  console.log(`Evidence collected: ${result.evidenceCollected}`)
  console.log(`Source pointers created: ${result.sourcePointersCreated}`)
  console.log(`Rules created: ${result.rulesCreated}`)
  console.log(`Rules auto-approved: ${result.rulesApproved}`)
  console.log(`Rules published: ${result.rulesPublished}`)
  if (result.releaseId) {
    console.log(`Release ID: ${result.releaseId}`)
  }
  console.log(`Errors: ${result.errors.length}`)

  if (result.errors.length > 0) {
    console.log("\nErrors:")
    result.errors.forEach((e) => console.log(`  - ${e}`))
  }

  return result
}

// CLI runner
if (require.main === module) {
  bootstrap()
    .then(async (result) => {
      await pool.end()
      process.exit(result.errors.length > 0 ? 1 : 0)
    })
    .catch(async (error) => {
      console.error("[bootstrap] Fatal error:", error)
      await pool.end()
      process.exit(1)
    })
}
