/**
 * System Registry Harvesters
 *
 * Combines all harvesters to produce a complete observed inventory.
 * All harvesters are DETERMINISTIC - no LLM heuristics.
 */

export { harvestRoutes } from "./harvest-routes"
export { harvestJobs } from "./harvest-jobs"
export { harvestWorkers } from "./harvest-workers"
export { harvestQueues } from "./harvest-queues"
export { harvestModules } from "./harvest-modules"
export { harvestLibs } from "./harvest-libs"
export { harvestStores } from "./harvest-stores"
export { harvestIntegrations } from "./harvest-integrations"
export { harvestUI } from "./harvest-ui"
export * from "./types"

import type { HarvesterResult, HarvesterError } from "./types"
import type { ObservedComponent } from "../schema"

import { harvestRoutes } from "./harvest-routes"
import { harvestJobs } from "./harvest-jobs"
import { harvestWorkers } from "./harvest-workers"
import { harvestQueues } from "./harvest-queues"
import { harvestModules } from "./harvest-modules"
import { harvestLibs } from "./harvest-libs"
import { harvestStores } from "./harvest-stores"
import { harvestIntegrations } from "./harvest-integrations"
import { harvestUI } from "./harvest-ui"

export interface FullHarvestResult {
  components: ObservedComponent[]
  errors: HarvesterError[]
  metadata: {
    executedAt: string
    totalDurationMs: number
    harvesterResults: {
      name: string
      componentCount: number
      errorCount: number
      durationMs: number
    }[]
  }
}

/**
 * Runs all harvesters and combines results.
 */
export async function harvestAll(projectRoot: string): Promise<FullHarvestResult> {
  const startTime = Date.now()
  const allComponents: ObservedComponent[] = []
  const allErrors: HarvesterError[] = []
  const harvesterResults: FullHarvestResult["metadata"]["harvesterResults"] = []

  const harvesters = [
    { name: "routes", fn: harvestRoutes },
    { name: "jobs", fn: harvestJobs },
    { name: "workers", fn: harvestWorkers },
    { name: "queues", fn: harvestQueues },
    { name: "modules", fn: harvestModules },
    { name: "libs", fn: harvestLibs },
    { name: "stores", fn: harvestStores },
    { name: "integrations", fn: harvestIntegrations },
    { name: "ui", fn: harvestUI },
  ]

  for (const { name, fn } of harvesters) {
    const result = await fn(projectRoot)

    allComponents.push(...result.components)
    allErrors.push(...result.errors)
    harvesterResults.push({
      name,
      componentCount: result.components.length,
      errorCount: result.errors.length,
      durationMs: result.metadata.durationMs,
    })
  }

  // Deduplicate components by componentId
  const seen = new Set<string>()
  const deduped = allComponents.filter((c) => {
    if (seen.has(c.componentId)) return false
    seen.add(c.componentId)
    return true
  })

  return {
    components: deduped,
    errors: allErrors,
    metadata: {
      executedAt: new Date().toISOString(),
      totalDurationMs: Date.now() - startTime,
      harvesterResults,
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestAll(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
