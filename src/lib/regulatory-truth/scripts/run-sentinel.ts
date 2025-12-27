// src/lib/regulatory-truth/scripts/run-sentinel.ts

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
 * Run Sentinel agent to discover new regulatory content
 */
async function main() {
  const args = process.argv.slice(2)

  // Check for --adaptive flag
  const useAdaptive = args.includes("--adaptive")

  if (useAdaptive) {
    console.log("Running in ADAPTIVE mode...")
    const { runAdaptiveSentinel } = await import("../agents/sentinel")
    const result = await runAdaptiveSentinel()

    console.log("\n=== Adaptive Sentinel Results ===")
    console.log(`Success: ${result.success}`)
    console.log(`Items scanned: ${result.itemsScanned}`)
    console.log(`Items changed: ${result.itemsChanged}`)
    console.log(`Errors: ${result.errors}`)
    console.log(`Endpoints processed: ${result.endpointsProcessed}`)

    await pool.end()
    process.exit(result.success ? 0 : 1)
  }

  // Dynamic import after env is loaded
  const { runSentinel, fetchDiscoveredItems } = await import("../agents/sentinel")

  const priorityArg = args[0] // "CRITICAL", "HIGH", "MEDIUM", "LOW", or undefined for all

  try {
    console.log("[sentinel] Running discovery agent...")

    // Validate priority argument
    let priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | undefined
    if (priorityArg) {
      if (!["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(priorityArg)) {
        console.error(
          `[sentinel] Invalid priority: ${priorityArg}. Use: CRITICAL, HIGH, MEDIUM, or LOW`
        )
        process.exit(1)
      }
      priority = priorityArg as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
      console.log(`[sentinel] Filtering to ${priority} priority endpoints`)
    } else {
      console.log("[sentinel] Processing all active endpoints")
    }

    // Run discovery
    const result = await runSentinel(priority)

    console.log("\n[sentinel] Discovery Results:")
    console.log(`  - Success: ${result.success}`)
    console.log(`  - Endpoints Checked: ${result.endpointsChecked}`)
    console.log(`  - New Items Discovered: ${result.newItemsDiscovered}`)

    if (result.errors.length > 0) {
      console.log(`  - Errors: ${result.errors.length}`)
      result.errors.forEach((err) => console.log(`    - ${err}`))
    }

    // Fetch discovered items
    if (result.newItemsDiscovered > 0) {
      console.log("\n[sentinel] Fetching discovered items...")
      const fetchResult = await fetchDiscoveredItems(100)
      console.log(`  - Fetched: ${fetchResult.fetched}`)
      console.log(`  - Failed: ${fetchResult.failed}`)
    }

    console.log("\n[sentinel] Complete!")
    process.exit(result.success ? 0 : 1)
  } finally {
    await pool.end()
  }
}

main().catch(async (error) => {
  console.error("[sentinel] Fatal error:", error)
  await pool.end()
  process.exit(1)
})
