// src/lib/regulatory-truth/scripts/run-releaser.ts

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

// Create pool for direct SQL
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/**
 * Run Releaser agent to create versioned release bundles
 */
async function main() {
  // Dynamic import after env is loaded
  const { runReleaser } = await import("../agents/releaser")

  const args = process.argv.slice(2)

  const client = await pool.connect()
  try {
    if (args.length > 0 && args[0] !== "--all") {
      // Run on specific rule IDs provided as arguments
      const ruleIds = args
      console.log(`[releaser] Creating release for ${ruleIds.length} rules`)

      const result = await runReleaser(ruleIds)

      if (result.success) {
        console.log(`[releaser] ✓ Release created:`)
        console.log(`  Release ID: ${result.releaseId}`)
        console.log(`  Version: ${result.output?.release.version}`)
        console.log(`  Rules published: ${result.publishedRuleIds.length}`)
        console.log(`  Effective from: ${result.output?.release.effective_from}`)
        console.log(`\nChangelog (HR):`)
        console.log(result.output?.release.changelog_hr)
      } else {
        console.error(`[releaser] ✗ ${result.error}`)
      }

      process.exit(result.success ? 0 : 1)
    } else {
      // Run on all approved rules that haven't been released yet
      console.log("[releaser] Finding approved rules not yet released...")

      // Find approved rules that are not yet published
      const result = await client.query(
        `SELECT r.id, r."conceptSlug", r."titleHr", r."riskTier", r."createdAt"
         FROM "RegulatoryRule" r
         WHERE r.status = 'APPROVED'
         ORDER BY r."riskTier" ASC, r."createdAt" ASC`
      )

      const approvedRules = result.rows
      console.log(`[releaser] Found ${approvedRules.length} approved rules ready for release`)

      if (approvedRules.length === 0) {
        console.log("[releaser] No approved rules to release")
        process.exit(0)
      }

      // Group by risk tier for display
      const byTier: Record<string, number> = {}
      for (const rule of approvedRules) {
        byTier[rule.riskTier] = (byTier[rule.riskTier] || 0) + 1
      }

      console.log("\nRules by risk tier:")
      for (const [tier, count] of Object.entries(byTier).sort()) {
        console.log(`  ${tier}: ${count} rules`)
      }

      // Create release with all approved rules
      const ruleIds = approvedRules.map((r: { id: string }) => r.id)
      console.log(`\n[releaser] Creating release bundle...`)

      const releaserResult = await runReleaser(ruleIds)

      if (releaserResult.success) {
        console.log(`\n[releaser] ✓ Release created successfully!`)
        console.log(`  Release ID: ${releaserResult.releaseId}`)
        console.log(`  Version: ${releaserResult.output?.release.version}`)
        console.log(`  Release Type: ${releaserResult.output?.release.release_type}`)
        console.log(`  Rules Published: ${releaserResult.publishedRuleIds.length}`)
        console.log(`  Effective From: ${releaserResult.output?.release.effective_from}`)
        console.log(`  Content Hash: ${releaserResult.output?.release.content_hash}`)

        console.log(`\nAudit Trail:`)
        const audit = releaserResult.output?.release.audit_trail
        if (audit) {
          console.log(`  Evidence Sources: ${audit.source_evidence_count}`)
          console.log(`  Source Pointers: ${audit.source_pointer_count}`)
          console.log(`  Reviews: ${audit.review_count}`)
          console.log(`  Human Approvals: ${audit.human_approvals}`)
        }

        console.log(`\nChangelog (Croatian):`)
        console.log("─".repeat(80))
        console.log(releaserResult.output?.release.changelog_hr)
        console.log("─".repeat(80))

        if (releaserResult.output?.release.changelog_en) {
          console.log(`\nChangelog (English):`)
          console.log("─".repeat(80))
          console.log(releaserResult.output?.release.changelog_en)
          console.log("─".repeat(80))
        }

        console.log(`\nRules included:`)
        for (const ruleInc of releaserResult.output?.release.rules_included || []) {
          console.log(
            `  - [${ruleInc.action.toUpperCase()}] ${ruleInc.concept_slug} (${ruleInc.rule_id})`
          )
          if (ruleInc.supersedes) {
            console.log(`    Supersedes: ${ruleInc.supersedes}`)
          }
        }

        process.exit(0)
      } else {
        console.error(`\n[releaser] ✗ Release failed: ${releaserResult.error}`)
        process.exit(1)
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(async (error) => {
  console.error("[releaser] Fatal error:", error)
  await pool.end()
  process.exit(1)
})
