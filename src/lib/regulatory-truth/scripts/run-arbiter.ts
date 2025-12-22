// src/lib/regulatory-truth/scripts/run-arbiter.ts

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
 * Run Arbiter agent on conflicts
 */
async function main() {
  // Dynamic import after env is loaded
  const { runArbiter, getPendingConflicts } = await import("../agents/arbiter")

  const args = process.argv.slice(2)
  const conflictId = args[0]

  const client = await pool.connect()
  try {
    if (conflictId) {
      // Run on specific conflict
      console.log(`[arbiter] Running on conflict: ${conflictId}`)

      const result = await client.query(
        `SELECT id, "conflictType", status, description FROM "RegulatoryConflict" WHERE id = $1`,
        [conflictId]
      )

      if (result.rows.length === 0) {
        console.error(`[arbiter] Conflict not found: ${conflictId}`)
        process.exit(1)
      }

      const conflict = result.rows[0]
      console.log(`[arbiter] Conflict: ${conflict.conflictType} (status: ${conflict.status})`)
      console.log(`[arbiter] Description: ${conflict.description}`)

      const arbiterResult = await runArbiter(conflictId)
      console.log("[arbiter] Result:", JSON.stringify(arbiterResult, null, 2))

      process.exit(arbiterResult.success ? 0 : 1)
    } else {
      // Run on all open conflicts
      console.log("[arbiter] Running on open conflicts...")

      const pendingConflicts = await getPendingConflicts()
      console.log(`[arbiter] Found ${pendingConflicts.length} open conflicts`)

      if (pendingConflicts.length === 0) {
        console.log("[arbiter] No conflicts to resolve")
        process.exit(0)
      }

      let resolved = 0
      let escalated = 0
      let failed = 0

      for (const conflict of pendingConflicts) {
        console.log(`\n[arbiter] Processing: ${conflict.conflictType} (${conflict.id})`)
        console.log(`[arbiter] Description: ${conflict.description}`)
        if (conflict.itemA) {
          console.log(`[arbiter] Rule A: ${conflict.itemA.titleHr} (${conflict.itemA.riskTier})`)
        }
        if (conflict.itemB) {
          console.log(`[arbiter] Rule B: ${conflict.itemB.titleHr} (${conflict.itemB.riskTier})`)
        }

        try {
          const arbiterResult = await runArbiter(conflict.id)

          if (arbiterResult.success && arbiterResult.output) {
            const resolution = arbiterResult.resolution
            const confidence = arbiterResult.output.arbitration.confidence
            const strategy = arbiterResult.output.arbitration.resolution.resolution_strategy

            switch (resolution) {
              case "RULE_A_PREVAILS":
                resolved++
                console.log(
                  `[arbiter] ✓ RESOLVED: Rule A prevails (strategy: ${strategy}, confidence: ${confidence.toFixed(2)})`
                )
                console.log(
                  `[arbiter]   Rationale: ${arbiterResult.output.arbitration.resolution.rationale_hr}`
                )
                break
              case "RULE_B_PREVAILS":
                resolved++
                console.log(
                  `[arbiter] ✓ RESOLVED: Rule B prevails (strategy: ${strategy}, confidence: ${confidence.toFixed(2)})`
                )
                console.log(
                  `[arbiter]   Rationale: ${arbiterResult.output.arbitration.resolution.rationale_hr}`
                )
                break
              case "MERGE_RULES":
                escalated++
                console.log(
                  `[arbiter] ⚠ MERGE_RULES recommended (strategy: ${strategy}, confidence: ${confidence.toFixed(2)})`
                )
                console.log("[arbiter]   This requires manual intervention")
                break
              case "ESCALATE_TO_HUMAN":
                escalated++
                console.log(`[arbiter] ⚠ ESCALATE_TO_HUMAN (confidence: ${confidence.toFixed(2)})`)
                if (arbiterResult.output.arbitration.human_review_reason) {
                  console.log(
                    `[arbiter]   Reason: ${arbiterResult.output.arbitration.human_review_reason}`
                  )
                }
                break
            }
          } else {
            failed++
            console.log(`[arbiter] ✗ ${arbiterResult.error}`)
          }
        } catch (error) {
          failed++
          console.error(`[arbiter] ✗ ${error}`)
        }

        // Rate limiting - wait 5 seconds between arbitrations
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }

      console.log(
        `\n[arbiter] Complete: ${resolved} resolved, ${escalated} escalated, ${failed} failed`
      )
      process.exit(failed > 0 ? 1 : 0)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(async (error) => {
  console.error("[arbiter] Fatal error:", error)
  await pool.end()
  process.exit(1)
})
