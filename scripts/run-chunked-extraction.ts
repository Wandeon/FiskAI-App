#!/usr/bin/env npx tsx
/**
 * Run Chunked Extraction on an NN Document
 *
 * Usage:
 *   npx tsx scripts/run-chunked-extraction.ts <evidenceId> [--maxChars 8000] [--maxChunks 200] [--delay 1000]
 */

import { config } from "dotenv"
import { readFileSync } from "fs"
import { parse } from "dotenv"

// Load .env.local first (has DATABASE_URL)
config({ path: ".env.local" })
// Then load .env (has OLLAMA keys)
config({ path: ".env" })

// Also explicitly load OLLAMA vars from .env
try {
  const envContent = readFileSync(".env", "utf-8")
  const parsed = parse(envContent)
  if (parsed.OLLAMA_EXTRACT_API_KEY)
    process.env.OLLAMA_EXTRACT_API_KEY = parsed.OLLAMA_EXTRACT_API_KEY
  if (parsed.OLLAMA_EXTRACT_ENDPOINT)
    process.env.OLLAMA_EXTRACT_ENDPOINT = parsed.OLLAMA_EXTRACT_ENDPOINT
  if (parsed.OLLAMA_EXTRACT_MODEL) process.env.OLLAMA_EXTRACT_MODEL = parsed.OLLAMA_EXTRACT_MODEL
  if (parsed.OLLAMA_API_KEY) process.env.OLLAMA_API_KEY = parsed.OLLAMA_API_KEY
  if (parsed.OLLAMA_ENDPOINT) process.env.OLLAMA_ENDPOINT = parsed.OLLAMA_ENDPOINT
  if (parsed.OLLAMA_MODEL) process.env.OLLAMA_MODEL = parsed.OLLAMA_MODEL
} catch {
  // .env may not exist
}

async function main() {
  // Dynamic imports after env is loaded
  const { planChunks, printChunkPlan } =
    await import("../src/lib/regulatory-truth/extraction/chunk-planner")
  const { runChunkedExtraction, storeExtractionResults, printExtractionSummary } =
    await import("../src/lib/regulatory-truth/extraction/chunked-extractor")
  const { dbReg } = await import("../src/lib/db")

  // Parse arguments
  const args = process.argv.slice(2)
  const evidenceId = args[0]

  if (!evidenceId) {
    console.error("Usage: npx tsx scripts/run-chunked-extraction.ts <evidenceId> [options]")
    console.error("Options:")
    console.error("  --maxChars <num>   Max chars per chunk (default: 8000)")
    console.error("  --maxChunks <num>  Max chunks to process (default: 200)")
    console.error("  --delay <ms>       Delay between chunks (default: 1000)")
    console.error("  --dryRun           Plan only, don't extract")
    process.exit(1)
  }

  const maxChars = parseInt(args.find((a, i) => args[i - 1] === "--maxChars") || "8000")
  const maxChunks = parseInt(args.find((a, i) => args[i - 1] === "--maxChunks") || "200")
  const delay = parseInt(args.find((a, i) => args[i - 1] === "--delay") || "1000")
  const dryRun = args.includes("--dryRun")

  // Get Ollama config from env
  const ollamaEndpoint = process.env.OLLAMA_EXTRACT_ENDPOINT || process.env.OLLAMA_ENDPOINT
  const ollamaApiKey = process.env.OLLAMA_EXTRACT_API_KEY || process.env.OLLAMA_API_KEY
  const ollamaModel = process.env.OLLAMA_EXTRACT_MODEL || process.env.OLLAMA_MODEL

  if (!ollamaEndpoint || !ollamaApiKey || !ollamaModel) {
    console.error("Missing Ollama configuration in environment")
    console.error("Required: OLLAMA_EXTRACT_ENDPOINT, OLLAMA_EXTRACT_API_KEY, OLLAMA_EXTRACT_MODEL")
    process.exit(1)
  }

  console.log("=".repeat(80))
  console.log("CHUNKED EXTRACTION")
  console.log("=".repeat(80))
  console.log()
  console.log("Evidence ID:", evidenceId)
  console.log("Max chars per chunk:", maxChars)
  console.log("Max chunks:", maxChunks)
  console.log("Delay between chunks:", delay, "ms")
  console.log("Dry run:", dryRun)
  console.log()
  console.log("Ollama endpoint:", ollamaEndpoint)
  console.log("Ollama model:", ollamaModel)
  console.log()

  // Get document
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      id: true,
      url: true,
      rawContent: true,
      source: { select: { name: true } },
    },
  })

  if (!evidence || !evidence.rawContent) {
    console.error("Evidence not found or has no content:", evidenceId)
    process.exit(1)
  }

  console.log("Document URL:", evidence.url)
  console.log("Document size:", evidence.rawContent.length, "chars")
  console.log()

  // Plan chunks
  const plan = planChunks(evidence.id, evidence.rawContent, maxChars)

  printChunkPlan(plan)
  console.log()

  // Limit chunks if requested
  if (plan.jobs.length > maxChunks) {
    console.log(`Limiting to first ${maxChunks} chunks`)
    plan.jobs.splice(maxChunks)
    plan.totalChunks = maxChunks
  }

  if (dryRun) {
    console.log("\nDry run - skipping extraction")
    await dbReg.$disconnect()
    return
  }

  // Run extraction
  console.log("\n" + "=".repeat(80))
  console.log("RUNNING EXTRACTION")
  console.log("=".repeat(80))
  console.log()

  const startTime = Date.now()

  const { results, summary } = await runChunkedExtraction(plan.jobs, {
    ollamaEndpoint,
    ollamaApiKey,
    ollamaModel,
    delayBetweenChunks: delay,
    onProgress: (completed, total, current) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const assertionCount = current.assertions.length
      const status = current.error ? "ERR" : current.truncated ? "TRUNC" : "OK"
      console.log(
        `[${completed}/${total}] ${current.nodePath}: ${assertionCount} assertions [${status}] (${elapsed}s)`
      )
    },
  })

  // Print summary
  printExtractionSummary(summary)

  // Store results
  console.log("\n" + "=".repeat(80))
  console.log("STORING RESULTS")
  console.log("=".repeat(80))
  console.log()

  const { agentRunId, candidateFactIds } = await storeExtractionResults(
    evidenceId,
    results,
    summary
  )

  console.log(`AgentRun ID: ${agentRunId}`)
  console.log(`CandidateFacts created: ${candidateFactIds.length}`)

  // Final coverage report
  console.log("\n" + "=".repeat(80))
  console.log("COVERAGE REPORT")
  console.log("=".repeat(80))
  console.log()
  console.log(`Document: ${evidence.url}`)
  console.log(`Chunks processed: ${summary.completedChunks}/${summary.totalChunks}`)
  console.log(`Assertions extracted: ${summary.totalAssertions}`)
  console.log(
    `Nodes with extractions: ${summary.nodesWithAssertions}/${summary.totalNodes} (${summary.coveragePercent}%)`
  )
  console.log(`Status: ${summary.status}`)

  await dbReg.$disconnect()
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
