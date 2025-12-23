#!/usr/bin/env tsx
// src/lib/regulatory-truth/e2e/run-e2e.ts
// CLI entry point for running Live E2E tests

import { runLiveE2E } from "./live-runner"

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const lightRun = args.includes("--light")
  const skipAssistant = args.includes("--skip-assistant")
  const help = args.includes("--help") || args.includes("-h")

  if (help) {
    console.log(`
Live E2E Testing Harness
========================

Usage: npx tsx src/lib/regulatory-truth/e2e/run-e2e.ts [options]

Options:
  --light           Run light mode (sentinel only, no full pipeline)
  --skip-assistant  Skip assistant citation compliance tests
  --help, -h        Show this help message

Examples:
  npx tsx src/lib/regulatory-truth/e2e/run-e2e.ts
  npx tsx src/lib/regulatory-truth/e2e/run-e2e.ts --light
  npx tsx src/lib/regulatory-truth/e2e/run-e2e.ts --skip-assistant

The harness validates 8 invariants:
  INV-1: Evidence Immutability (contentHash = SHA-256)
  INV-2: Rule Traceability (all rules have source pointers)
  INV-3: No Inference Extraction (values must appear in quotes)
  INV-4: Arbiter Conflict Resolution (no auto-resolve without evidence)
  INV-5: Release Hash Determinism (same content = same hash)
  INV-6: Assistant Citation Compliance (only cite PUBLISHED + sourced)
  INV-7: Discovery Idempotency (no duplicate discoveries)
  INV-8: T0/T1 Human Approval Gates (critical rules need human approval)

Verdicts:
  GO             - All invariants PASS
  NO-GO          - One or more invariants FAIL
  CONDITIONAL-GO - All PASS or PARTIAL, no FAIL
  INVALID        - Environment validation failed
`)
    process.exit(0)
  }

  console.log("Starting Live E2E Testing Harness...")
  console.log(`Options: lightRun=${lightRun}, skipAssistant=${skipAssistant}`)

  try {
    const result = await runLiveE2E({ lightRun, skipAssistant })

    console.log("\n" + "=".repeat(72))
    console.log(`FINAL VERDICT: ${result.verdict}`)
    console.log("=".repeat(72))

    if (result.verdict === "GO") {
      console.log("\n✅ All invariants passed! System is production-ready.")
      process.exit(0)
    } else if (result.verdict === "CONDITIONAL-GO") {
      console.log("\n⚠️ Some invariants partial. Review recommended before production.")
      process.exit(0)
    } else if (result.verdict === "NO-GO") {
      console.log("\n❌ Invariant failures detected. DO NOT deploy to production.")
      const failures = Object.values(result.invariants.results)
        .filter((r) => r.status === "FAIL")
        .map((r) => `  - ${r.id}: ${r.details}`)
      console.log("Failures:")
      failures.forEach((f) => console.log(f))
      process.exit(1)
    } else {
      console.log("\n⚫ Invalid run - environment check failed.")
      console.log(`Reason: ${result.fingerprint.invalidReason}`)
      process.exit(2)
    }
  } catch (error) {
    console.error("\n❌ E2E run failed with error:")
    console.error(error)
    process.exit(3)
  }
}

main()
