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
         LIMIT 200`
      )

      const pendingRules = result.rows
      console.log(`[reviewer] Found ${pendingRules.length} rules needing review`)

      let approved = 0
      let rejected = 0
      let escalated = 0
      let failed = 0

      // Process in batches for better throughput (issue #176)
      const BATCH_SIZE = 10
      const BATCH_DELAY = 5000 // 5 seconds between batches

      for (let i = 0; i < pendingRules.length; i += BATCH_SIZE) {
        const batch = pendingRules.slice(i, i + BATCH_SIZE)
        console.log(
          `\n[reviewer] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(pendingRules.length / BATCH_SIZE)} (${batch.length} rules)`
        )

        // Process batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(async (rule) => {
            console.log(
              `[reviewer] Processing: ${rule.conceptSlug} (${rule.riskTier}, ${rule.source_pointer_count} sources)`
            )

            const reviewerResult = await runReviewer(rule.id)

            if (reviewerResult.success && reviewerResult.output) {
              const decision = reviewerResult.output.review_result.decision
              const confidence = reviewerResult.output.review_result.computed_confidence

              switch (decision) {
                case "APPROVE":
                  console.log(
                    `[reviewer] ✓ ${rule.conceptSlug} APPROVED (confidence: ${confidence.toFixed(2)})`
                  )
                  return { status: "approved", rule }
                case "REJECT":
                  console.log(
                    `[reviewer] ✗ ${rule.conceptSlug} REJECTED (confidence: ${confidence.toFixed(2)})`
                  )
                  if (reviewerResult.output.review_result.issues_found.length > 0) {
                    console.log(
                      `[reviewer]   Issues: ${reviewerResult.output.review_result.issues_found.length}`
                    )
                  }
                  return { status: "rejected", rule }
                case "ESCALATE_HUMAN":
                case "ESCALATE_ARBITER":
                  console.log(
                    `[reviewer] ⚠ ${rule.conceptSlug} ${decision} (confidence: ${confidence.toFixed(2)})`
                  )
                  return { status: "escalated", rule }
              }
            } else {
              console.log(`[reviewer] ✗ ${rule.conceptSlug} ${reviewerResult.error}`)
              return { status: "failed", rule, error: reviewerResult.error }
            }
          })
        )

        // Count results
        for (const result of batchResults) {
          if (result.status === "fulfilled" && result.value) {
            switch (result.value.status) {
              case "approved":
                approved++
                break
              case "rejected":
                rejected++
                break
              case "escalated":
                escalated++
                break
              case "failed":
                failed++
                break
            }
          } else if (result.status === "rejected") {
            failed++
            console.error(`[reviewer] ✗ Batch processing error: ${result.reason}`)
          }
        }

        console.log(
          `[reviewer] Batch complete: ${approved} approved, ${rejected} rejected, ${escalated} escalated, ${failed} failed so far`
        )

        // Wait before next batch
        if (i + BATCH_SIZE < pendingRules.length) {
          console.log(`[reviewer] Waiting ${BATCH_DELAY}ms before next batch...`)
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY))
        }
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
