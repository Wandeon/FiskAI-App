// src/lib/regulatory-truth/scripts/run-extractor.ts

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
 * Run Extractor agent on evidence records
 */
async function main() {
  // Dynamic import after env is loaded
  const { runExtractor } = await import("../agents/extractor")

  const args = process.argv.slice(2)
  const evidenceId = args[0]

  const client = await pool.connect()
  try {
    if (evidenceId) {
      // Run on specific evidence
      console.log(`[extractor] Running on evidence: ${evidenceId}`)

      const result = await client.query(
        `SELECT id, "sourceId", url FROM "Evidence" WHERE id = $1`,
        [evidenceId]
      )

      if (result.rows.length === 0) {
        console.error(`[extractor] Evidence not found: ${evidenceId}`)
        process.exit(1)
      }

      const extractorResult = await runExtractor(evidenceId)
      console.log("[extractor] Result:", JSON.stringify(extractorResult, null, 2))

      process.exit(extractorResult.success ? 0 : 1)
    } else {
      // Run on all unprocessed evidence
      console.log("[extractor] Running on unprocessed evidence...")

      // Find evidence that has no source pointers yet
      const result = await client.query(
        `SELECT e.id, e."sourceId", e.url, s.slug, s.name
         FROM "Evidence" e
         JOIN "RegulatorySource" s ON e."sourceId" = s.id
         WHERE NOT EXISTS (
           SELECT 1 FROM "SourcePointer" sp WHERE sp."evidenceId" = e.id
         )
         ORDER BY e."fetchedAt" DESC
         LIMIT 50`
      )

      const unprocessedEvidence = result.rows
      console.log(`[extractor] Found ${unprocessedEvidence.length} unprocessed evidence records`)

      let success = 0
      let failed = 0
      let totalPointers = 0

      for (const evidence of unprocessedEvidence) {
        console.log(`\n[extractor] Processing: ${evidence.slug} (${evidence.id})`)

        try {
          const extractorResult = await runExtractor(evidence.id)

          if (extractorResult.success) {
            success++
            totalPointers += extractorResult.sourcePointerIds.length
            console.log(
              `[extractor] ✓ Extracted ${extractorResult.sourcePointerIds.length} data points`
            )
          } else {
            failed++
            console.log(`[extractor] ✗ ${extractorResult.error}`)
          }
        } catch (error) {
          failed++
          console.error(`[extractor] ✗ ${error}`)
        }

        // Rate limiting - wait 15 seconds between extractions to avoid Ollama 429
        await new Promise((resolve) => setTimeout(resolve, 15000))
      }

      console.log(
        `\n[extractor] Complete: ${success} success, ${failed} failed, ${totalPointers} total pointers`
      )
      process.exit(failed > 0 ? 1 : 0)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(async (error) => {
  console.error("[extractor] Fatal error:", error)
  await pool.end()
  process.exit(1)
})
