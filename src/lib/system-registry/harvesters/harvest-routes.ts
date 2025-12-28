/**
 * Route Group Harvester
 *
 * Deterministically scans src/app/api/ for API route groups.
 * Discovery method: route-scan
 *
 * A route group is any directory under src/app/api/ that contains route.ts files.
 */

import { existsSync, readdirSync, statSync } from "fs"
import { join, relative } from "path"
import type { HarvesterResult, HarvesterError } from "./types"
import { createObservedComponent, toComponentId } from "./types"

const API_ROOT = "src/app/api"

interface RouteGroupInfo {
  name: string
  path: string
  endpointCount: number
  methods: string[]
}

/**
 * Recursively counts route.ts files and collects methods.
 */
function countRoutes(dirPath: string): { count: number; methods: Set<string> } {
  let count = 0
  const methods = new Set<string>()

  if (!existsSync(dirPath)) {
    return { count, methods }
  }

  const entries = readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      const sub = countRoutes(fullPath)
      count += sub.count
      sub.methods.forEach((m) => methods.add(m))
    } else if (entry.name === "route.ts" || entry.name === "route.tsx") {
      count++
      // Could parse file for GET, POST, etc. but keeping it simple
      methods.add("ROUTE")
    }
  }

  return { count, methods }
}

/**
 * Harvests all API route groups from src/app/api/.
 */
export async function harvestRoutes(projectRoot: string): Promise<HarvesterResult> {
  const startTime = Date.now()
  const errors: HarvesterError[] = []
  const routeGroups: RouteGroupInfo[] = []

  const apiRoot = join(projectRoot, API_ROOT)

  if (!existsSync(apiRoot)) {
    return {
      components: [],
      errors: [
        {
          path: apiRoot,
          message: "API root directory does not exist",
          recoverable: false,
        },
      ],
      metadata: {
        harvesterName: "harvest-routes",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        scanPaths: [apiRoot],
      },
    }
  }

  // Get top-level directories (these are route groups)
  const entries = readdirSync(apiRoot, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    // Skip special Next.js directories
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue

    const groupPath = join(apiRoot, entry.name)
    const { count, methods } = countRoutes(groupPath)

    if (count > 0) {
      routeGroups.push({
        name: entry.name,
        path: relative(projectRoot, groupPath),
        endpointCount: count,
        methods: Array.from(methods),
      })
    }
  }

  // Convert to ObservedComponents
  const components = routeGroups.map((group) =>
    createObservedComponent(
      toComponentId("ROUTE_GROUP", group.name),
      "ROUTE_GROUP",
      `${group.name.charAt(0).toUpperCase() + group.name.slice(1)} API`,
      [group.path],
      "route-scan",
      {
        endpointCount: group.endpointCount,
      }
    )
  )

  return {
    components,
    errors,
    metadata: {
      harvesterName: "harvest-routes",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      scanPaths: [apiRoot],
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestRoutes(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
