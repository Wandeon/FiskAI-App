/**
 * Workers Harvester
 *
 * Deterministically scans docker-compose.workers.yml for worker definitions.
 * Discovery method: compose-service
 *
 * A worker is any service in docker-compose.workers.yml.
 */

import { existsSync, readFileSync } from "fs"
import { join } from "path"
import * as yaml from "js-yaml"
import type { HarvesterResult, HarvesterError } from "./types"
import { createObservedComponent, toComponentId } from "./types"
import { WORKER_SERVICE_EXCLUSIONS } from "../governance"

const COMPOSE_FILE = "docker-compose.workers.yml"

interface ComposeService {
  build?: string | { context: string; dockerfile: string }
  command?: string | string[]
  environment?: Record<string, string> | string[]
}

interface ComposeFile {
  services?: Record<string, ComposeService>
}

/**
 * Harvests all workers from docker-compose.workers.yml.
 */
export async function harvestWorkers(projectRoot: string): Promise<HarvesterResult> {
  const startTime = Date.now()
  const errors: HarvesterError[] = []

  const composePath = join(projectRoot, COMPOSE_FILE)

  if (!existsSync(composePath)) {
    return {
      components: [],
      errors: [
        {
          path: composePath,
          message: "docker-compose.workers.yml does not exist",
          recoverable: false,
        },
      ],
      metadata: {
        harvesterName: "harvest-workers",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        scanPaths: [composePath],
      },
    }
  }

  let compose: ComposeFile
  try {
    const content = readFileSync(composePath, "utf-8")
    compose = yaml.load(content) as ComposeFile
  } catch (e) {
    return {
      components: [],
      errors: [
        {
          path: composePath,
          message: `Failed to parse YAML: ${e instanceof Error ? e.message : String(e)}`,
          recoverable: false,
        },
      ],
      metadata: {
        harvesterName: "harvest-workers",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        scanPaths: [composePath],
      },
    }
  }

  if (!compose.services) {
    return {
      components: [],
      errors: [
        {
          path: composePath,
          message: "No services defined in compose file",
          recoverable: true,
        },
      ],
      metadata: {
        harvesterName: "harvest-workers",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        scanPaths: [composePath],
      },
    }
  }

  const excluded = new Set(WORKER_SERVICE_EXCLUSIONS.map((e) => e.name))

  // Convert services to ObservedComponents
  const components = Object.entries(compose.services)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([name]) => !excluded.has(name))
    .map(([name]) => {
      // Extract worker name from service name
      const workerName = name.replace(/^fiskai-/, "").replace(/^worker-/, "")

      return createObservedComponent(
        toComponentId("WORKER", workerName),
        "WORKER",
        `${workerName
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")} Worker`,
        [COMPOSE_FILE],
        "compose-service",
        {
          serviceName: name,
        }
      )
    })

  return {
    components,
    errors,
    metadata: {
      harvesterName: "harvest-workers",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      scanPaths: [composePath],
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestWorkers(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
