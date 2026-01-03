#!/usr/bin/env node
/**
 * Schema Ownership Checker
 *
 * Detects tables defined in both Prisma and Drizzle ORMs.
 * This is a CI guardrail to prevent split-brain schema drift.
 *
 * Exit codes:
 *   0 - No overlap found
 *   1 - Overlap detected (dual-defined tables)
 *
 * Usage:
 *   node scripts/check-schema-ownership.mjs
 *   node scripts/check-schema-ownership.mjs --allowlist docs/contracts/schema-ownership-allowlist.json
 */

import { readFileSync, readdirSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

// Paths
const PRISMA_SCHEMA = join(ROOT, "prisma/schema.prisma")
const DRIZZLE_SCHEMA_DIR = join(ROOT, "src/lib/db/schema")
const DEFAULT_ALLOWLIST = join(ROOT, "docs/contracts/schema-ownership-allowlist.json")

// =============================================================================
// Drizzle Extractor
// =============================================================================

/**
 * Extract table names from Drizzle schema files.
 * Captures the first string argument of pgTable("table_name", ...)
 */
function extractDrizzleTables(schemaDir) {
  const tables = new Map() // tableName -> { file, line }

  if (!existsSync(schemaDir)) {
    console.warn(`Warning: Drizzle schema dir not found: ${schemaDir}`)
    return tables
  }

  const files = readdirSync(schemaDir).filter((f) => f.endsWith(".ts"))

  for (const file of files) {
    const filePath = join(schemaDir, file)
    const content = readFileSync(filePath, "utf-8")
    const lines = content.split("\n")

    // Track state for multi-line pgTable calls
    let inPgTable = false
    let pgTableStartLine = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      // Check for pgTable( on this line
      if (line.includes("pgTable(")) {
        // Try to find the table name on the same line
        // Pattern: pgTable("table_name" or pgTable('table_name'
        const sameLine = line.match(/pgTable\s*\(\s*["']([^"']+)["']/)
        if (sameLine) {
          const tableName = sameLine[1]
          // Skip FK reference tables (User, Company defined just for relations)
          if (!isReferenceTable(tableName, content)) {
            tables.set(tableName, { file, line: lineNum })
          }
        } else {
          // Table name might be on next line
          inPgTable = true
          pgTableStartLine = lineNum
        }
      } else if (inPgTable) {
        // Look for the table name on this line
        const nextLine = line.match(/^\s*["']([^"']+)["']/)
        if (nextLine) {
          const tableName = nextLine[1]
          if (!isReferenceTable(tableName, content)) {
            tables.set(tableName, { file, line: pgTableStartLine })
          }
          inPgTable = false
        } else if (line.trim() && !line.trim().startsWith("//")) {
          // Non-empty, non-comment line without a string - abort
          inPgTable = false
        }
      }
    }
  }

  return tables
}

/**
 * Check if a table is just a FK reference table (like User, Company).
 * These are allowed in Drizzle for relation purposes.
 */
function isReferenceTable(tableName, fileContent) {
  // Reference tables typically have only an id field and are used for FK constraints
  const refTables = ["User", "Company"]
  return refTables.includes(tableName)
}

// =============================================================================
// Prisma Extractor
// =============================================================================

/**
 * Extract table names from Prisma schema.
 * Captures:
 *   - model ModelName { ... } (model name = table name unless @@map)
 *   - @@map("actual_table_name") inside model blocks
 */
function extractPrismaTables(schemaPath) {
  const tables = new Map() // tableName -> { modelName, line, hasMap }

  if (!existsSync(schemaPath)) {
    console.error(`Error: Prisma schema not found: ${schemaPath}`)
    process.exit(1)
  }

  const content = readFileSync(schemaPath, "utf-8")
  const lines = content.split("\n")

  let currentModel = null
  let modelStartLine = 0
  let hasMap = false
  let mapTarget = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Check for model definition
    const modelMatch = line.match(/^\s*model\s+([A-Za-z0-9_]+)\s*\{/)
    if (modelMatch) {
      // Save previous model if exists
      if (currentModel) {
        const tableName = mapTarget || currentModel
        tables.set(tableName, {
          modelName: currentModel,
          line: modelStartLine,
          hasMap,
        })
      }

      currentModel = modelMatch[1]
      modelStartLine = lineNum
      hasMap = false
      mapTarget = null
    }

    // Check for @@map directive
    const mapMatch = line.match(/@@map\s*\(\s*["']([^"']+)["']\s*\)/)
    if (mapMatch && currentModel) {
      hasMap = true
      mapTarget = mapMatch[1]
    }

    // Check for end of model block
    if (line.match(/^\s*\}/) && currentModel) {
      const tableName = mapTarget || currentModel
      tables.set(tableName, {
        modelName: currentModel,
        line: modelStartLine,
        hasMap,
      })
      currentModel = null
      hasMap = false
      mapTarget = null
    }
  }

  return tables
}

// =============================================================================
// Allowlist
// =============================================================================

function loadAllowlist(path) {
  if (!existsSync(path)) {
    return new Map()
  }

  try {
    const content = JSON.parse(readFileSync(path, "utf-8"))
    const allowlist = new Map()

    for (const entry of content.allowed || []) {
      // Check expiry
      if (entry.expires) {
        const expiryDate = new Date(entry.expires)
        if (expiryDate < new Date()) {
          console.warn(`Warning: Allowlist entry expired: ${entry.table} (${entry.expires})`)
          continue
        }
      }
      allowlist.set(entry.table, entry)
    }

    return allowlist
  } catch (e) {
    console.warn(`Warning: Could not parse allowlist: ${e.message}`)
    return new Map()
  }
}

// =============================================================================
// Main
// =============================================================================

function main() {
  console.log("Schema Ownership Checker")
  console.log("========================\n")

  // Parse args
  const args = process.argv.slice(2)
  let allowlistPath = DEFAULT_ALLOWLIST
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--allowlist" && args[i + 1]) {
      allowlistPath = args[i + 1]
    }
  }

  // Extract tables
  console.log("Extracting Drizzle tables...")
  const drizzleTables = extractDrizzleTables(DRIZZLE_SCHEMA_DIR)
  console.log(`  Found ${drizzleTables.size} tables\n`)

  console.log("Extracting Prisma tables...")
  const prismaTables = extractPrismaTables(PRISMA_SCHEMA)
  console.log(`  Found ${prismaTables.size} tables\n`)

  // Load allowlist
  const allowlist = loadAllowlist(allowlistPath)
  if (allowlist.size > 0) {
    console.log(`Loaded ${allowlist.size} allowlist entries\n`)
  }

  // Find overlap
  const overlap = []
  for (const [tableName, drizzleInfo] of drizzleTables) {
    if (prismaTables.has(tableName)) {
      if (allowlist.has(tableName)) {
        console.log(`  Allowlisted: ${tableName}`)
        continue
      }
      const prismaInfo = prismaTables.get(tableName)
      overlap.push({
        table: tableName,
        drizzle: drizzleInfo,
        prisma: prismaInfo,
      })
    }
  }

  // Report
  if (overlap.length === 0) {
    console.log("Result: No dual-defined tables found")
    console.log("\nSchema ownership is clean.")
    process.exit(0)
  }

  console.log("\n" + "=".repeat(60))
  console.log("ERROR: Dual-defined tables detected!")
  console.log("=".repeat(60) + "\n")

  console.log("The following tables are defined in BOTH Prisma and Drizzle:")
  console.log("This violates the data access ownership contract.\n")

  for (const item of overlap) {
    console.log(`Table: ${item.table}`)
    console.log(`  Drizzle: src/lib/db/schema/${item.drizzle.file}:${item.drizzle.line}`)
    console.log(
      `  Prisma:  prisma/schema.prisma:${item.prisma.line} (model ${item.prisma.modelName})`
    )
    console.log("")
  }

  console.log("Resolution:")
  console.log("  1. Remove the table from one ORM (prefer keeping in Drizzle if Drizzle-accessed)")
  console.log("  2. Or add to allowlist with expiry if migration in progress")
  console.log("")
  console.log("See: docs/contracts/data-access-ownership.md")

  process.exit(1)
}

main()
