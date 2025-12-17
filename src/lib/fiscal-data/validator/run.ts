#!/usr/bin/env npx tsx
// src/lib/fiscal-data/validator/run.ts

/**
 * Fiscal Data Validator - Entry Point
 *
 * This script is run weekly via GitHub Actions to validate fiscal data
 * against official Croatian government sources.
 *
 * Usage:
 *   npx tsx src/lib/fiscal-data/validator/run.ts
 *
 * Environment variables:
 *   - OLLAMA_API_URL: Ollama API endpoint (default: http://localhost:11434)
 *   - OLLAMA_MODEL: Model to use (default: llama3.1)
 *   - GITHUB_TOKEN: GitHub token for creating PRs
 *   - GITHUB_REPO: Repository in format "owner/repo"
 *   - DRY_RUN: If "true", don't create PR, just report
 */

import { validateAllSources, getValidationSummary, getChangesForPR } from "./validate"
import { createUpdatePR, createValidationIssue } from "./create-pr"

async function main() {
  console.log("=".repeat(60))
  console.log("🔍 Fiscal Data Validator")
  console.log(`📅 ${new Date().toLocaleString("hr-HR")}`)
  console.log("=".repeat(60))
  console.log()

  const isDryRun = process.env.DRY_RUN === "true"

  try {
    // 1. Run validation
    console.log("📡 Fetching and validating official sources...")
    console.log()

    const results = await validateAllSources(true) // Primary sources only

    // 2. Generate summary
    const summary = getValidationSummary(results)

    console.log()
    console.log("📊 Validation Summary:")
    console.log(`   ✅ Matches: ${summary.matches}`)
    console.log(`   ⚠️  Mismatches: ${summary.mismatches}`)
    console.log(`   ❓ Uncertain: ${summary.uncertain}`)
    console.log(`   ❌ Errors: ${summary.errors}`)
    console.log(`   📊 Total: ${summary.total}`)
    console.log()

    // 3. Get changes for PR (high confidence mismatches)
    const changes = getChangesForPR(results)

    if (changes.length > 0) {
      console.log(`🔄 Found ${changes.length} high-confidence change(s):`)
      for (const change of changes) {
        console.log(
          `   - ${change.dataPoint}: ${change.currentValue} → ${change.foundValue} (${Math.round(change.confidence * 100)}%)`
        )
      }
      console.log()

      if (isDryRun) {
        console.log("🏃 DRY RUN - Not creating PR")
      } else {
        // 4. Create PR with changes
        console.log("📝 Creating pull request...")
        const prUrl = await createUpdatePR(changes)

        if (prUrl) {
          console.log(`✅ PR created: ${prUrl}`)
        } else {
          console.log("⚠️  Failed to create PR, creating issue instead...")
          const issueUrl = await createValidationIssue(changes, summary)
          if (issueUrl) {
            console.log(`📋 Issue created: ${issueUrl}`)
          }
        }
      }
    } else {
      console.log("✨ No changes detected - all values match official sources!")

      // Still create a summary issue if there were errors
      if (summary.errors > 0 && !isDryRun) {
        console.log()
        console.log("⚠️  Some sources had errors, creating summary issue...")
        const issueUrl = await createValidationIssue([], summary)
        if (issueUrl) {
          console.log(`📋 Issue created: ${issueUrl}`)
        }
      }
    }

    // 5. Output detailed results
    console.log()
    console.log("=".repeat(60))
    console.log("📋 Detailed Results:")
    console.log("=".repeat(60))

    for (const result of results) {
      const icon =
        result.status === "match"
          ? "✅"
          : result.status === "mismatch"
            ? "⚠️"
            : result.status === "error"
              ? "❌"
              : "❓"

      console.log(`${icon} ${result.dataPoint}`)
      console.log(`   Current: ${result.currentValue}`)
      console.log(`   Found: ${result.foundValue ?? "N/A"}`)
      console.log(`   Confidence: ${Math.round(result.confidence * 100)}%`)
      console.log(`   Source: ${result.sourceUrl}`)
      console.log()
    }

    // Exit with appropriate code
    if (summary.errors > 0) {
      process.exit(1)
    }

    process.exit(0)
  } catch (error) {
    console.error()
    console.error("❌ Validation failed:", error)
    process.exit(1)
  }
}

// Run if executed directly
main()
