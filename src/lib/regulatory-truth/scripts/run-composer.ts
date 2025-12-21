// src/lib/regulatory-truth/scripts/run-composer.ts

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
 * Run Composer agent on source pointers
 */
async function main() {
  // Dynamic import after env is loaded
  const { runComposer, runComposerBatch } = await import("../agents/composer")

  const args = process.argv.slice(2)
  const client = await pool.connect()

  try {
    if (args.length > 0 && args[0] !== "--batch") {
      // Run on specific source pointer IDs
      const sourcePointerIds = args
      console.log(`[composer] Running on source pointers: ${sourcePointerIds.join(", ")}`)

      // Verify source pointers exist
      const result = await client.query(
        `SELECT id, domain, "extractedValue", "exactQuote", confidence
         FROM "SourcePointer"
         WHERE id = ANY($1)`,
        [sourcePointerIds]
      )

      if (result.rows.length === 0) {
        console.error(`[composer] No source pointers found for IDs: ${sourcePointerIds.join(", ")}`)
        process.exit(1)
      }

      console.log(`[composer] Found ${result.rows.length} source pointers:`)
      for (const sp of result.rows) {
        console.log(`  - ${sp.id}: ${sp.domain} (${sp.extractedValue})`)
      }

      const composerResult = await runComposer(sourcePointerIds)
      console.log("[composer] Result:", JSON.stringify(composerResult, null, 2))

      process.exit(composerResult.success ? 0 : 1)
    } else {
      // Run on all ungrouped source pointers
      console.log("[composer] Running batch mode on ungrouped source pointers...")

      // Find source pointers that are not yet linked to any rule
      const result = await client.query(
        `SELECT sp.id, sp.domain, sp."extractedValue", sp.confidence,
                e.url, s.name as source_name
         FROM "SourcePointer" sp
         JOIN "Evidence" e ON sp."evidenceId" = e.id
         JOIN "RegulatorySource" s ON e."sourceId" = s.id
         WHERE NOT EXISTS (
           SELECT 1 FROM "_RuleSourcePointers" rsp WHERE rsp."B" = sp.id
         )
         ORDER BY sp.domain, sp.confidence DESC
         LIMIT 100`
      )

      const ungroupedPointers = result.rows
      console.log(`[composer] Found ${ungroupedPointers.length} ungrouped source pointers`)

      if (ungroupedPointers.length === 0) {
        console.log("[composer] No ungrouped source pointers to process")
        process.exit(0)
      }

      // Group by domain
      const grouped: Record<string, typeof ungroupedPointers> = {}
      for (const sp of ungroupedPointers) {
        if (!grouped[sp.domain]) {
          grouped[sp.domain] = []
        }
        grouped[sp.domain].push(sp)
      }

      console.log("\n[composer] Source pointers by domain:")
      for (const [domain, pointers] of Object.entries(grouped)) {
        console.log(`  ${domain}: ${pointers.length} pointers`)
      }
      console.log("")

      const batchResult = await runComposerBatch()

      console.log(
        `\n[composer] Complete: ${batchResult.success} success, ${batchResult.failed} failed, ${batchResult.totalRules} total rules created`
      )

      if (batchResult.errors.length > 0) {
        console.log("\n[composer] Errors:")
        for (const error of batchResult.errors) {
          console.log(`  - ${error}`)
        }
      }

      process.exit(batchResult.failed > 0 ? 1 : 0)
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(async (error) => {
  console.error("[composer] Fatal error:", error)
  await pool.end()
  process.exit(1)
})
