#!/usr/bin/env npx tsx
/**
 * Generate Coverage Review Report for an Evidence document
 *
 * Usage:
 *   npx tsx scripts/generate-coverage-review.ts <evidenceId> [--skipLlm] [--maxSamples N]
 */

import { config } from "dotenv"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { parse } from "dotenv"

// Load environment
config({ path: ".env.local" })
config({ path: ".env" })

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
  const { generateCoverageReview, formatReportMarkdown } =
    await import("../src/lib/regulatory-truth/extraction/coverage-review")

  // Parse arguments
  const args = process.argv.slice(2)
  const evidenceId = args[0]

  if (!evidenceId) {
    console.error("Usage: npx tsx scripts/generate-coverage-review.ts <evidenceId> [options]")
    console.error("Options:")
    console.error("  --skipLlm        Skip LLM verification (faster, less accurate)")
    console.error("  --maxSamples N   Max samples to verify (default: 30)")
    process.exit(1)
  }

  const skipLlmVerification = args.includes("--skipLlm")
  const maxSamples = parseInt(args.find((a, i) => args[i - 1] === "--maxSamples") || "30")

  // Get Ollama config
  const ollamaEndpoint = process.env.OLLAMA_EXTRACT_ENDPOINT || process.env.OLLAMA_ENDPOINT
  const ollamaApiKey = process.env.OLLAMA_EXTRACT_API_KEY || process.env.OLLAMA_API_KEY
  const ollamaModel = process.env.OLLAMA_EXTRACT_MODEL || process.env.OLLAMA_MODEL

  if (!ollamaEndpoint || !ollamaApiKey || !ollamaModel) {
    console.error("Missing Ollama configuration")
    process.exit(1)
  }

  console.log("=".repeat(80))
  console.log("COVERAGE REVIEW REPORT GENERATOR")
  console.log("=".repeat(80))
  console.log()
  console.log("Evidence ID:", evidenceId)
  console.log("Skip LLM verification:", skipLlmVerification)
  console.log("Max samples:", maxSamples)
  console.log()

  // Generate report
  console.log("Generating coverage review report...")
  const startTime = Date.now()

  const report = await generateCoverageReview(evidenceId, {
    ollamaEndpoint,
    ollamaApiKey,
    ollamaModel,
    maxSamples,
    skipLlmVerification,
  })

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`Report generated in ${duration}s`)
  console.log()

  // Format and save markdown
  const markdown = formatReportMarkdown(report)

  // Ensure directories exist
  mkdirSync("docs/audits", { recursive: true })
  mkdirSync("tmp", { recursive: true })

  // Save files
  const mdPath = `docs/audits/coverage-review-${evidenceId}.md`
  const jsonPath = `tmp/coverage-review-${evidenceId}.json`

  writeFileSync(mdPath, markdown)
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  console.log("Files saved:")
  console.log(`  Markdown: ${mdPath}`)
  console.log(`  JSON: ${jsonPath}`)
  console.log()

  // Print summary
  console.log("=".repeat(80))
  console.log("VERDICT SUMMARY")
  console.log("=".repeat(80))
  console.log()
  console.log(`Ready for Auto-Ingest: ${report.verdict.readyForAutoIngest ? "YES ✓" : "NO ✗"}`)
  console.log(`Confidence: ${report.verdict.confidenceLevel}`)
  console.log()
  console.log(
    `Coverage: ${report.structuralCoverage.coveragePercent}% (${report.structuralCoverage.coveredNodes}/${report.structuralCoverage.totalNodes} nodes)`
  )
  console.log(
    `Bindable: ${report.usability.bindablePercent}% (${report.usability.bindable}/${report.usability.totalAssertions})`
  )
  console.log(`Quality: ${report.qualitySampling.overallAccuracy}% accuracy`)
  console.log()

  if (report.verdict.blockers.length > 0) {
    console.log("BLOCKERS:")
    for (const b of report.verdict.blockers) {
      console.log(`  ❌ ${b}`)
    }
    console.log()
  }

  if (report.verdict.nextFixes.length > 0) {
    console.log("NEXT FIXES:")
    for (let i = 0; i < report.verdict.nextFixes.length; i++) {
      console.log(`  ${i + 1}. ${report.verdict.nextFixes[i]}`)
    }
    console.log()
  }

  console.log("ASSESSMENT (Croatian):")
  console.log(`  ${report.verdict.assessmentCroatian}`)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
