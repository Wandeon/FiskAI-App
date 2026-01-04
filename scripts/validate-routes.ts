#!/usr/bin/env npx tsx
/**
 * Route Validation Script
 *
 * Ensures all routes in the registry have corresponding page.tsx files.
 * Run in CI to catch missing pages before deployment.
 *
 * Usage:
 *   npx tsx scripts/validate-routes.ts
 *
 * Exit codes:
 *   0 - All routes valid
 *   1 - Missing routes found
 */

import fs from "fs"
import path from "path"
import { routes, type RouteId, type RouteCategory } from "../src/config/routes"

const APP_DIR = path.join(process.cwd(), "src", "app")

// Route groups in the app directory
const ROUTE_GROUPS: Record<RouteCategory, string> = {
  core: "(marketing)",
  marketing: "(marketing)",
  tools: "(marketing)",
  content: "(marketing)",
  news: "(marketing)",
  legal: "(marketing)",
  auth: "(marketing)", // Auth pages are in marketing for public access
  app: "(app)",
  internal: "(staff)", // or (admin)
}

interface ValidationResult {
  routeId: RouteId
  path: string
  expectedFile: string
  exists: boolean
  category: RouteCategory
}

function pathToFileLocation(routePath: string, category: RouteCategory): string {
  // Remove leading slash
  let cleanPath = routePath.replace(/^\//, "")

  // Handle dynamic segments [slug] -> keep as is
  // Handle root path
  if (cleanPath === "" || cleanPath === "en") {
    cleanPath = ""
  }

  // Get route group
  const routeGroup = ROUTE_GROUPS[category]

  // Build expected file path
  if (cleanPath === "") {
    return path.join(APP_DIR, routeGroup, "page.tsx")
  }

  return path.join(APP_DIR, routeGroup, cleanPath, "page.tsx")
}

function validateRoutes(): ValidationResult[] {
  const results: ValidationResult[] = []

  for (const [routeId, routeDef] of Object.entries(routes)) {
    // Only validate Croatian paths (primary)
    const hrPath = routeDef.path.hr

    // Skip dynamic routes that depend on content
    if (hrPath.includes("[")) {
      continue
    }

    const expectedFile = pathToFileLocation(hrPath, routeDef.category)
    const exists = fs.existsSync(expectedFile)

    results.push({
      routeId: routeId as RouteId,
      path: hrPath,
      expectedFile: expectedFile.replace(process.cwd(), "."),
      exists,
      category: routeDef.category,
    })
  }

  return results
}

function main() {
  console.log("🔍 Validating route registry against filesystem...\n")

  const results = validateRoutes()
  const missing = results.filter((r) => !r.exists)
  const valid = results.filter((r) => r.exists)

  // Print valid routes
  console.log(`✅ Valid routes: ${valid.length}`)

  // Print missing routes
  if (missing.length > 0) {
    console.log(`\n❌ Missing routes: ${missing.length}\n`)

    for (const result of missing) {
      console.log(`  ${result.routeId}`)
      console.log(`    Path: ${result.path}`)
      console.log(`    Expected: ${result.expectedFile}`)
      console.log(`    Category: ${result.category}\n`)
    }

    console.log("\n💡 Fix options:")
    console.log("   1. Create the missing page.tsx files")
    console.log("   2. Remove the route from src/config/routes.ts")
    console.log("   3. Set sitemap: false if the route is intentionally missing\n")

    process.exit(1)
  }

  console.log("\n✨ All routes are valid!\n")

  // Summary by category
  const byCategory = results.reduce(
    (acc, r) => {
      acc[r.category] = (acc[r.category] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  console.log("📊 Routes by category:")
  for (const [category, count] of Object.entries(byCategory)) {
    console.log(`   ${category}: ${count}`)
  }

  process.exit(0)
}

main()
