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
 *   - OLLAMA_ENDPOINT: Ollama Cloud API endpoint (default: https://ollama.com)
 *   - OLLAMA_API_KEY: Ollama Cloud API key (required for cloud)
 *   - OLLAMA_MODEL: Model to use (default: llama3.1)
 *   - GITHUB_TOKEN: GitHub token for creating PRs
 *   - GITHUB_REPO: Repository in format "owner/repo"
 *   - DRY_RUN: If "true", don't create PR, just report
 */

// Load environment variables from .env file
import "dotenv/config"

import { validateAllSources, getValidationSummary, getChangesForPR } from "./validate"
import { createUpdatePR, createValidationIssue } from "./create-pr"
import {
  verifyAgainstRTL,
  createAuditEntry,
  createChangeNotification,
  createContentSyncEvent,
  type RTLVerificationResult,
} from "./rtl-bridge"
import { getValueByPath } from "../utils/get-value"
import { Pool } from "pg"

async function main() {
  console.log("=".repeat(60))
  console.log("🔍 Fiscal Data Validator with RTL Integration")
  console.log(`📅 ${new Date().toLocaleString("hr-HR")}`)
  console.log("=".repeat(60))
  console.log()

  const isDryRun = process.env.DRY_RUN === "true"
  const useRTL = process.env.USE_RTL !== "false" // Default to true

  // Initialize database pool for RTL verification
  let pool: Pool | null = null
  if (useRTL && process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL })
    console.log("🔗 RTL Integration: ENABLED")
  } else {
    console.log("🔗 RTL Integration: DISABLED (no DATABASE_URL)")
  }
  console.log()

  try {
    // 1. Run validation against official sources
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

    // 2.5. RTL Verification - cross-reference with Regulatory Truth Layer
    const rtlResults: RTLVerificationResult[] = []
    if (pool) {
      console.log("🔍 Cross-referencing with Regulatory Truth Layer...")
      console.log()

      for (const result of results) {
        const rtlResult = await verifyAgainstRTL(result, pool)
        rtlResults.push(rtlResult)

        if (rtlResult.hasRTLData) {
          const icon = rtlResult.sourcePointerIds.length > 0 ? "✓" : "○"
          console.log(
            `   ${icon} ${result.dataPoint}: ${rtlResult.sourcePointerIds.length} RTL pointers, ` +
              `${rtlResult.evidenceIds.length} evidence records`
          )
        }
      }

      console.log()
      console.log(
        `📊 RTL Coverage: ${rtlResults.filter((r) => r.hasRTLData).length}/${results.length} data points backed by RTL`
      )
      console.log()

      // Create audit entries for changes
      const auditEntries = rtlResults
        .filter((r) => r.status === "mismatch")
        .map((r) => {
          const currentValue = getValueByPath(r.dataPoint)
          const prevValue =
            typeof currentValue === "object" && currentValue !== null && "value" in currentValue
              ? (currentValue as { value: number }).value
              : (currentValue as number | string | null)
          return createAuditEntry(r, prevValue)
        })

      if (auditEntries.length > 0) {
        console.log("📝 Created Audit Trail Entries:")
        for (const entry of auditEntries) {
          console.log(
            `   - ${entry.dataPoint}: ${entry.previousValue} → ${entry.newValue} (${entry.status})`
          )
        }
        console.log()
      }

      // Create content sync events for high-confidence changes
      const syncEvents = rtlResults
        .filter((r) => r.status === "mismatch" && r.confidence >= 0.8)
        .map((r) => {
          const currentValue = getValueByPath(r.dataPoint)
          const prevValue =
            typeof currentValue === "object" && currentValue !== null && "value" in currentValue
              ? (currentValue as { value: number }).value
              : (currentValue as number | string | null)
          return createContentSyncEvent(r, prevValue)
        })
        .filter((e) => e !== null)

      if (syncEvents.length > 0) {
        console.log("📤 Content Sync Events Generated:")
        for (const event of syncEvents) {
          console.log(
            `   - ${event!.conceptId}: ${event!.changeType} → ${event!.newValue} (severity: ${event!.severity})`
          )
        }
        console.log()
      }

      // Create notification
      const notification = createChangeNotification(rtlResults)
      if (notification) {
        console.log(`🔔 Notification: ${notification.severity.toUpperCase()}`)
        console.log(`   Title: ${notification.title}`)
        console.log(`   Message: ${notification.message}`)
        console.log()
      }
    }

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
      if (pool) await pool.end()
      process.exit(1)
    }

    if (pool) await pool.end()
    process.exit(0)
  } catch (error) {
    console.error()
    console.error("❌ Validation failed:", error)
    if (pool) await pool.end()
    process.exit(1)
  }
}

// Run if executed directly
main()
