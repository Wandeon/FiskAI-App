/**
 * Modules Harvester
 *
 * Deterministically scans src/lib/modules/definitions.ts for module definitions.
 * Discovery method: config-reference
 *
 * Modules are defined in a central definition file.
 */

import { existsSync, readFileSync } from "fs"
import { join, relative } from "path"
import type { HarvesterResult, HarvesterError } from "./types"
import { createObservedComponent, toComponentId } from "./types"

const MODULE_DEFINITIONS_PATH = "src/lib/modules/definitions.ts"

interface ModuleInfo {
  id: string
  name: string
  path: string
}

/**
 * Extracts module definitions from the definitions file.
 */
function extractModules(filePath: string, projectRoot: string): ModuleInfo[] {
  const modules: ModuleInfo[] = []

  if (!existsSync(filePath)) {
    return modules
  }

  const content = readFileSync(filePath, "utf-8")
  const relativePath = relative(projectRoot, filePath)

  // Pattern: ModuleId (enum or type union)
  // Look for: "invoicing" | "e-invoicing" | ...
  const moduleIdPattern = /["']([a-z][a-z0-9-]+)["']\s*(?:\||,)/g
  let match

  // Also look for module definitions in objects
  // { id: "invoicing", name: "Invoicing", ... }
  const moduleObjectPattern = /id:\s*["']([a-z][a-z0-9-]+)["']/g

  // Track seen modules to avoid duplicates
  const seen = new Set<string>()

  // Extract from enum/type patterns
  while ((match = moduleIdPattern.exec(content)) !== null) {
    const id = match[1]
    if (!seen.has(id) && id.length > 2) {
      seen.add(id)
      // Convert kebab-case to Title Case
      const name = id
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
      modules.push({ id, name, path: relativePath })
    }
  }

  // Extract from object definitions
  while ((match = moduleObjectPattern.exec(content)) !== null) {
    const id = match[1]
    if (!seen.has(id)) {
      seen.add(id)
      const name = id
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
      modules.push({ id, name, path: relativePath })
    }
  }

  return modules
}

/**
 * Harvests all modules from the definitions file.
 */
export async function harvestModules(projectRoot: string): Promise<HarvesterResult> {
  const startTime = Date.now()
  const errors: HarvesterError[] = []

  const definitionsPath = join(projectRoot, MODULE_DEFINITIONS_PATH)

  if (!existsSync(definitionsPath)) {
    return {
      components: [],
      errors: [
        {
          path: definitionsPath,
          message: "Module definitions file does not exist",
          recoverable: false,
        },
      ],
      metadata: {
        harvesterName: "harvest-modules",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        scanPaths: [MODULE_DEFINITIONS_PATH],
      },
    }
  }

  const modules = extractModules(definitionsPath, projectRoot)

  // Convert to ObservedComponents
  const components = modules.map((module) =>
    createObservedComponent(
      toComponentId("MODULE", module.id),
      "MODULE",
      module.name,
      [module.path],
      "config-reference"
    )
  )

  return {
    components,
    errors,
    metadata: {
      harvesterName: "harvest-modules",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      scanPaths: [MODULE_DEFINITIONS_PATH],
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestModules(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
