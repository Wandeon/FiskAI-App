#!/usr/bin/env npx tsx

/**
 * Validates the Concept Registry for the RTL Content Sync system.
 * Checks that all conceptIds are valid, unique, and point to existing MDX files.
 *
 * Usage: npx tsx scripts/validate-concept-registry.ts
 */

import fs from "fs"
import path from "path"
import {
  CONCEPT_REGISTRY,
  getAllConceptIds,
} from "../src/lib/regulatory-truth/content-sync/concept-registry"

const CONTENT_DIR = path.join(process.cwd(), "content")

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  stats: {
    totalConcepts: number
    totalPaths: number
    missingPaths: number
    duplicateIds: number
    orphanedPaths: number
  }
}

function validateRegistry(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const allPaths = new Set<string>()
  let missingPaths = 0

  // Check for duplicate IDs
  const ids = getAllConceptIds()
  const idCounts = new Map<string, number>()
  for (const id of ids) {
    idCounts.set(id, (idCounts.get(id) || 0) + 1)
  }
  const duplicateIds = [...idCounts.entries()].filter(([_, count]) => count > 1)
  if (duplicateIds.length > 0) {
    for (const [id, count] of duplicateIds) {
      errors.push(`Duplicate conceptId: "${id}" appears ${count} times`)
    }
  }

  // Validate each mapping
  for (const mapping of CONCEPT_REGISTRY) {
    // Check conceptId format (lowercase with hyphens only)
    if (!/^[a-z0-9-]+$/.test(mapping.conceptId)) {
      errors.push(
        `Invalid conceptId format: "${mapping.conceptId}" (use lowercase with hyphens)`
      )
    }

    // Check description
    if (!mapping.description || mapping.description.length < 10) {
      warnings.push(`Concept "${mapping.conceptId}" has short/missing description`)
    }

    // Check paths exist
    for (const mdxPath of mapping.mdxPaths) {
      allPaths.add(mdxPath)
      const fullPath = path.join(CONTENT_DIR, mdxPath)
      if (!fs.existsSync(fullPath)) {
        errors.push(`Missing MDX file: ${mdxPath} (concept: ${mapping.conceptId})`)
        missingPaths++
      }
    }

    // Check for empty paths
    if (mapping.mdxPaths.length === 0) {
      warnings.push(`Concept "${mapping.conceptId}" has no MDX paths`)
    }

    // Check all paths end with .mdx
    for (const mdxPath of mapping.mdxPaths) {
      if (!mdxPath.endsWith(".mdx")) {
        errors.push(
          `Invalid path extension: "${mdxPath}" should end with .mdx (concept: ${mapping.conceptId})`
        )
      }
    }
  }

  // Check for orphaned MDX files (files not in any concept)
  const orphanedPaths: string[] = []
  const contentDirs = ["vodici", "rjecnik", "kako-da", "usporedbe", "hubovi"]
  for (const dir of contentDirs) {
    const dirPath = path.join(CONTENT_DIR, dir)
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".mdx"))
      for (const file of files) {
        const relativePath = `${dir}/${file}`
        if (!allPaths.has(relativePath)) {
          orphanedPaths.push(relativePath)
        }
      }
    }
  }

  if (orphanedPaths.length > 0) {
    warnings.push(
      `${orphanedPaths.length} MDX files not mapped to any concept: ${orphanedPaths.slice(0, 5).join(", ")}${orphanedPaths.length > 5 ? "..." : ""}`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalConcepts: CONCEPT_REGISTRY.length,
      totalPaths: allPaths.size,
      missingPaths,
      duplicateIds: duplicateIds.length,
      orphanedPaths: orphanedPaths.length,
    },
  }
}

// Run validation
console.log("Validating Concept Registry...\n")

const result = validateRegistry()

console.log("Stats:")
console.log(`  Concepts: ${result.stats.totalConcepts}`)
console.log(`  Unique paths: ${result.stats.totalPaths}`)
console.log(`  Missing paths: ${result.stats.missingPaths}`)
console.log(`  Duplicate IDs: ${result.stats.duplicateIds}`)
console.log(`  Orphaned MDX files: ${result.stats.orphanedPaths}`)
console.log()

if (result.warnings.length > 0) {
  console.log("Warnings:")
  for (const w of result.warnings) {
    console.log(`  \u26A0\uFE0F  ${w}`)
  }
  console.log()
}

if (result.errors.length > 0) {
  console.log("Errors:")
  for (const e of result.errors) {
    console.log(`  \u274C ${e}`)
  }
  console.log()
  process.exit(1)
}

console.log("\u2705 Concept registry is valid!")
