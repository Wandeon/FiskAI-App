// src/lib/regulatory-truth/scripts/run-reviewer.ts

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
 * Run Reviewer agent on rules pending review
 */
async function main() {
  // Dynamic import after env is loaded
  const { runReviewer } = await import("../agents/reviewer")

  const args = process.argv.slice(2)
  const ruleId = args[0]

  const client = await pool.connect()
  try {
    if (ruleId) {
      // Run on specific rule
      console.log(`[reviewer] Running on rule: ${ruleId}`)

      const result = await client.query(
        `SELECT id, "conceptSlug", status, "riskTier" FROM "RegulatoryRule" WHERE id = $1`,
        [ruleId]
      )

      if (result.rows.length === 0) {
        console.error(`[reviewer] Rule not found: ${ruleId}`)
        process.exit(1)
      }

      const rule = result.rows[0]
      console.log(
        `[reviewer] Rule: ${rule.conceptSlug} (status: ${rule.status}, tier: ${rule.riskTier})`
      )

      const reviewerResult = await runReviewer(ruleId)
      console.log("[reviewer] Result:", JSON.stringify(reviewerResult, null, 2))

      process.exit(reviewerResult.success ? 0 : 1)
    } else {
      // Run on all rules with status DRAFT or PENDING_REVIEW
      console.log("[reviewer] Running on rules needing review...")

      const result = await client.query(
        `SELECT r.id, r."conceptSlug", r.status, r."riskTier", r."titleHr",
                COUNT(sp.id) as source_pointer_count
         FROM "RegulatoryRule" r
         LEFT JOIN "_RuleSourcePointers" rsp ON r.id = rsp."B"
         LEFT JOIN "SourcePointer" sp ON rsp."A" = sp.id
         WHERE r.status IN ('DRAFT', 'PENDING_REVIEW')
         GROUP BY r.id, r."conceptSlug", r.status, r."riskTier", r."titleHr"
         ORDER BY r."createdAt" DESC
         LIMIT 50`
      )

      const pendingRules = result.rows
      console.log(`[reviewer] Found ${pendingRules.length} rules needing review`)

      let approved = 0
      let rejected = 0
      let escalated = 0
      let failed = 0

      for (const rule of pendingRules) {
        console.log(
          `\n[reviewer] Processing: ${rule.conceptSlug} (${rule.riskTier}, ${rule.source_pointer_count} sources)`
        )
        console.log(`[reviewer] Title: ${rule.titleHr}`)

        try {
          const reviewerResult = await runReviewer(rule.id)

          if (reviewerResult.success && reviewerResult.output) {
            const decision = reviewerResult.output.review_result.decision
            const confidence = reviewerResult.output.review_result.computed_confidence

            switch (decision) {
              case "APPROVE":
                approved++
                console.log(`[reviewer] ✓ APPROVED (confidence: ${confidence.toFixed(2)})`)
                break
              case "REJECT":
                rejected++
                console.log(`[reviewer] ✗ REJECTED (confidence: ${confidence.toFixed(2)})`)
                if (reviewerResult.output.review_result.issues_found.length > 0) {
                  console.log(
                    `[reviewer]   Issues: ${reviewerResult.output.review_result.issues_found.length}`
                  )
                  for (const issue of reviewerResult.output.review_result.issues_found) {
                    console.log(`[reviewer]   - [${issue.severity}] ${issue.description}`)
                  }
                }
                break
              case "ESCALATE_HUMAN":
              case "ESCALATE_ARBITER":
                escalated++
                console.log(`[reviewer] ⚠ ${decision} (confidence: ${confidence.toFixed(2)})`)
                if (reviewerResult.output.review_result.human_review_reason) {
                  console.log(
                    `[reviewer]   Reason: ${reviewerResult.output.review_result.human_review_reason}`
                  )
                }
                break
            }
          } else {
            failed++
            console.log(`[reviewer] ✗ ${reviewerResult.error}`)
          }
        } catch (error) {
          failed++
          console.error(`[reviewer] ✗ ${error}`)
        }

        // Rate limiting - wait 3 seconds between reviews
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }

      console.log(
        `\n[reviewer] Complete: ${approved} approved, ${rejected} rejected, ${escalated} escalated, ${failed} failed`
      )
      process.exit(failed > 0 ? 1 : 0)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(async (error) => {
  console.error("[reviewer] Fatal error:", error)
  await pool.end()
  process.exit(1)
})
