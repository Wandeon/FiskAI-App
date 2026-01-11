#!/usr/bin/env npx tsx
/**
 * CI/CD Script: Verify Type A Feature Tables
 *
 * This script checks that all Type A feature tables exist in the database.
 * Run this after migrations to ensure deployment is healthy.
 *
 * IMPORTANT: This script imports table definitions from feature-contracts.ts.
 * Do NOT duplicate table lists here - that's the source of truth drift bug.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/check-feature-tables.ts
 *
 * Exit codes:
 *   0 - All Type A feature tables exist
 *   1 - One or more Type A feature tables are missing
 *   2 - Could not connect to database
 *
 * Options:
 *   --strict    Exit 1 if ANY enforced feature is unhealthy (default in prod)
 *   --verbose   Show detailed output for each feature
 *   --all       Check all features (including Type B)
 */

import { Client } from "pg"

// Import from single source of truth - NO local table definitions!
import { FEATURES, type FeatureId, type FeatureType } from "../src/lib/admin/feature-contracts"

interface FeatureCheckResult {
  featureId: string
  name: string
  type: FeatureType
  enforced: boolean
  configured: boolean
  missingTables: string[]
  requiredTables: readonly string[]
}

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    ) as exists`,
    [tableName]
  )
  return result.rows[0]?.exists === true
}

function isEnforcementEnabled(type: FeatureType, envFlag: string): boolean {
  const envValue = process.env[envFlag]

  // Explicit disable takes precedence
  if (envValue === "false" || envValue === "0") return false

  // Type B features are never enforced unless explicitly promoted
  if (type === "B") {
    return envValue === "true" || envValue === "1"
  }

  // Type A in production: default to enforced
  if (process.env.NODE_ENV === "production") return true

  // Type A in development: opt-in
  return envValue === "true" || envValue === "1"
}

async function main() {
  const verbose = process.argv.includes("--verbose")
  const strict = process.argv.includes("--strict") || process.env.NODE_ENV === "production"
  const checkAll = process.argv.includes("--all")

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set")
    process.exit(2)
  }

  const client = new Client({ connectionString })

  try {
    await client.connect()
    console.log("✅ Connected to database")
    console.log(`   Schema: public (explicitly checked)`)
  } catch (error) {
    console.error("❌ Could not connect to database:", error)
    process.exit(2)
  }

  let allEnforcedHealthy = true
  const results: FeatureCheckResult[] = []

  for (const [featureId, feature] of Object.entries(FEATURES)) {
    const enforced = isEnforcementEnabled(feature.type, feature.envFlag)

    // Skip Type B features unless --all is passed
    if (!checkAll && feature.type === "B" && !enforced) {
      if (verbose) {
        console.log(`⏭️  ${feature.name}: SKIPPED (Type B, not enforced)`)
      }
      continue
    }

    const missingTables: string[] = []
    for (const table of feature.requiredTables) {
      if (!(await tableExists(client, table))) {
        missingTables.push(table)
      }
    }

    const configured = missingTables.length === 0
    if (enforced && !configured) allEnforcedHealthy = false

    results.push({
      featureId,
      name: feature.name,
      type: feature.type,
      enforced,
      configured,
      missingTables,
      requiredTables: feature.requiredTables,
    })
  }

  await client.end()

  // Output results
  console.log("\n=== Feature Contract Verification ===\n")

  for (const result of results) {
    const typeLabel = result.type === "A" ? "[Type A]" : "[Type B]"

    if (!result.enforced && !checkAll) {
      if (verbose) {
        console.log(
          `⏭️  ${result.name} ${typeLabel}: SKIPPED (not enforced via ${FEATURES[result.featureId as FeatureId].envFlag})`
        )
      }
      continue
    }

    if (result.configured) {
      const enforceStatus = result.enforced ? "✓ enforced" : "○ optional"
      console.log(
        `✅ ${result.name} ${typeLabel}: All ${result.requiredTables.length} tables exist (${enforceStatus})`
      )
      if (verbose) {
        for (const table of result.requiredTables) {
          console.log(`   ✓ ${table}`)
        }
      }
    } else {
      const severityIcon = result.enforced ? "❌" : "⚠️"
      const severityLabel = result.enforced ? "MISSING TABLES" : "MISSING TABLES (optional)"
      console.log(`${severityIcon} ${result.name} ${typeLabel}: ${severityLabel}`)
      for (const table of result.missingTables) {
        console.log(`   ✗ ${table}`)
      }
    }
  }

  console.log("")

  const enforcedResults = results.filter((r) => r.enforced)
  const unhealthyEnforced = enforcedResults.filter((r) => !r.configured)
  const optionalResults = results.filter((r) => !r.enforced)
  const unhealthyOptional = optionalResults.filter((r) => !r.configured)

  // Summary
  console.log("=== Summary ===")
  console.log(`Enforced features: ${enforcedResults.length}`)
  console.log(`  Healthy: ${enforcedResults.length - unhealthyEnforced.length}`)
  console.log(`  Missing tables: ${unhealthyEnforced.length}`)

  if (checkAll && optionalResults.length > 0) {
    console.log(`Optional features: ${optionalResults.length}`)
    console.log(`  Configured: ${optionalResults.length - unhealthyOptional.length}`)
    console.log(`  Not configured: ${unhealthyOptional.length}`)
  }

  console.log("")

  if (enforcedResults.length === 0) {
    console.log("ℹ️  No features enforced in this environment. Nothing to verify.")
    process.exit(0)
  }

  if (allEnforcedHealthy) {
    console.log(`✅ All ${enforcedResults.length} enforced feature(s) have their required tables.`)
    process.exit(0)
  } else {
    console.error(
      `\n❌ DEPLOYMENT DEFECT: ${unhealthyEnforced.length} enforced feature(s) are missing required tables.`
    )
    console.error("   Run migrations to fix: npm run prisma:migrate && npm run db:migrate")

    if (strict) {
      console.error("\n   Exiting with error (--strict mode or production)")
      process.exit(1)
    } else {
      console.warn("\n   ⚠️  Not exiting with error (development mode, use --strict to enforce)")
      process.exit(0)
    }
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error)
  process.exit(2)
})
