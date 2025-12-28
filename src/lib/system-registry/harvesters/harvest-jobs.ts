/**
 * Jobs Harvester
 *
 * Deterministically scans src/app/api/cron/ for cron job definitions.
 * Discovery method: cron-route
 *
 * A job is any directory under src/app/api/cron/ that contains a route.ts file.
 */

import { existsSync, readdirSync, readFileSync } from "fs"
import { join, relative } from "path"
import type { HarvesterResult, HarvesterError } from "./types"
import { createObservedComponent, toComponentId } from "./types"

const CRON_ROOT = "src/app/api/cron"

interface JobInfo {
  name: string
  path: string
  hasRoute: boolean
  schedule?: string
}

/**
 * Recursively finds all job directories with route.ts files.
 */
function findJobs(
  dirPath: string,
  projectRoot: string,
  prefix: string = ""
): JobInfo[] {
  const jobs: JobInfo[] = []

  if (!existsSync(dirPath)) {
    return jobs
  }

  const entries = readdirSync(dirPath, { withFileTypes: true })

  // Check if this directory has a route.ts
  const hasRoute = entries.some(
    (e) => e.name === "route.ts" || e.name === "route.tsx"
  )

  if (hasRoute && prefix) {
    // This is a job directory
    jobs.push({
      name: prefix,
      path: relative(projectRoot, dirPath),
      hasRoute: true,
    })
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue
    if (entry.name.startsWith("[") && entry.name.endsWith("]")) continue // Skip dynamic routes

    const subPath = join(dirPath, entry.name)
    const newPrefix = prefix ? `${prefix}-${entry.name}` : entry.name
    jobs.push(...findJobs(subPath, projectRoot, newPrefix))
  }

  return jobs
}

/**
 * Harvests all cron jobs from src/app/api/cron/.
 */
export async function harvestJobs(projectRoot: string): Promise<HarvesterResult> {
  const startTime = Date.now()
  const errors: HarvesterError[] = []

  const cronRoot = join(projectRoot, CRON_ROOT)

  if (!existsSync(cronRoot)) {
    return {
      components: [],
      errors: [
        {
          path: cronRoot,
          message: "Cron root directory does not exist",
          recoverable: false,
        },
      ],
      metadata: {
        harvesterName: "harvest-jobs",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        scanPaths: [cronRoot],
      },
    }
  }

  const jobs = findJobs(cronRoot, projectRoot)

  // Convert to ObservedComponents
  const components = jobs.map((job) =>
    createObservedComponent(
      toComponentId("JOB", job.name),
      "JOB",
      `${job.name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")} Job`,
      [job.path],
      "cron-route",
      job.schedule ? { schedule: job.schedule } : undefined
    )
  )

  return {
    components,
    errors,
    metadata: {
      harvesterName: "harvest-jobs",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      scanPaths: [cronRoot],
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestJobs(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
