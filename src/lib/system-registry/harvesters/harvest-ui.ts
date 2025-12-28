/**
 * UI Harvester
 *
 * Deterministically scans for UI portal definitions.
 * Discovery method: directory-exists
 *
 * Detects UI portals by:
 * - Next.js route groups in src/app/
 * - Marketing, app, staff, admin directories
 */

import { existsSync, readdirSync } from "fs"
import { join, relative } from "path"
import type { HarvesterResult, HarvesterError } from "./types"
import { createObservedComponent, toComponentId } from "./types"

interface UIInfo {
  name: string
  displayName: string
  path: string
}

// Known UI portal patterns (Next.js route groups)
const KNOWN_PORTALS: Record<string, string> = {
  "(marketing)": "Marketing Portal",
  "(app)": "App Portal",
  "(staff)": "Staff Portal",
  "(admin)": "Admin Portal",
}

/**
 * Harvests all UI portals from src/app/.
 */
export async function harvestUI(projectRoot: string): Promise<HarvesterResult> {
  const startTime = Date.now()
  const errors: HarvesterError[] = []
  const portals: UIInfo[] = []

  const appPath = join(projectRoot, "src/app")

  if (!existsSync(appPath)) {
    return {
      components: [],
      errors: [
        {
          path: appPath,
          message: "src/app directory does not exist",
          recoverable: false,
        },
      ],
      metadata: {
        harvesterName: "harvest-ui",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        scanPaths: ["src/app"],
      },
    }
  }

  const entries = readdirSync(appPath, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    // Check if it's a known portal route group
    const portalName = KNOWN_PORTALS[entry.name]
    if (portalName) {
      // Extract portal type from route group name
      const portalType = entry.name.replace(/[()]/g, "")
      portals.push({
        name: `portal-${portalType}`,
        displayName: portalName,
        path: relative(projectRoot, join(appPath, entry.name)),
      })
    }
  }

  // Convert to ObservedComponents
  const components = portals.map((portal) =>
    createObservedComponent(
      toComponentId("UI", portal.name),
      "UI",
      portal.displayName,
      [portal.path],
      "directory-exists"
    )
  )

  return {
    components,
    errors,
    metadata: {
      harvesterName: "harvest-ui",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      scanPaths: ["src/app"],
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestUI(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
