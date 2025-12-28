/**
 * Stores Harvester
 *
 * Deterministically scans for data store definitions.
 * Discovery method: config-reference
 *
 * Detects:
 * - PostgreSQL: prisma/schema.prisma or drizzle config
 * - Redis: docker-compose services or ioredis usage
 * - R2/S3: @aws-sdk/client-s3 usage
 */

import { existsSync, readFileSync } from "fs"
import { join } from "path"
import * as yaml from "js-yaml"
import type { HarvesterResult, HarvesterError } from "./types"
import { createObservedComponent, toComponentId } from "./types"

interface StoreInfo {
  name: string
  storeType: string
  path: string
}

interface ComposeFile {
  services?: Record<string, { image?: string }>
}

/**
 * Harvests all data stores from project configuration.
 */
export async function harvestStores(projectRoot: string): Promise<HarvesterResult> {
  const startTime = Date.now()
  const errors: HarvesterError[] = []
  const stores: StoreInfo[] = []
  const scannedPaths: string[] = []

  // Check for PostgreSQL (Prisma)
  const prismaPath = join(projectRoot, "prisma/schema.prisma")
  if (existsSync(prismaPath)) {
    scannedPaths.push("prisma/schema.prisma")
    stores.push({
      name: "postgresql",
      storeType: "PostgreSQL",
      path: "prisma/schema.prisma",
    })
  }

  // Check for Drizzle
  const drizzlePaths = [
    "drizzle.config.ts",
    "drizzle.config.js",
    "src/db/schema.ts",
  ]
  for (const drizzlePath of drizzlePaths) {
    const fullPath = join(projectRoot, drizzlePath)
    if (existsSync(fullPath)) {
      scannedPaths.push(drizzlePath)
      // Only add if we haven't already found PostgreSQL
      if (!stores.some((s) => s.name === "postgresql")) {
        stores.push({
          name: "postgresql",
          storeType: "PostgreSQL (Drizzle)",
          path: drizzlePath,
        })
      }
      break
    }
  }

  // Check docker-compose files for Redis
  const composeFiles = [
    "docker-compose.yml",
    "docker-compose.yaml",
    "docker-compose.workers.yml",
    "docker-compose.dev.yml",
  ]

  for (const composeFile of composeFiles) {
    const composePath = join(projectRoot, composeFile)
    if (!existsSync(composePath)) continue
    scannedPaths.push(composeFile)

    try {
      const content = readFileSync(composePath, "utf-8")
      const compose = yaml.load(content) as ComposeFile

      if (compose?.services) {
        for (const [serviceName, service] of Object.entries(compose.services)) {
          // Check for Redis
          if (
            serviceName.includes("redis") ||
            service?.image?.includes("redis")
          ) {
            if (!stores.some((s) => s.name === "redis")) {
              stores.push({
                name: "redis",
                storeType: "Redis",
                path: composeFile,
              })
            }
          }
        }
      }
    } catch (e) {
      errors.push({
        path: composePath,
        message: `Failed to parse YAML: ${e instanceof Error ? e.message : String(e)}`,
        recoverable: true,
      })
    }
  }

  // Check for R2/S3 usage in package.json
  const packageJsonPath = join(projectRoot, "package.json")
  if (existsSync(packageJsonPath)) {
    scannedPaths.push("package.json")
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }

      if (deps["@aws-sdk/client-s3"]) {
        stores.push({
          name: "r2",
          storeType: "Cloudflare R2",
          path: "package.json (@aws-sdk/client-s3)",
        })
      }
    } catch (e) {
      errors.push({
        path: packageJsonPath,
        message: `Failed to parse package.json: ${e instanceof Error ? e.message : String(e)}`,
        recoverable: true,
      })
    }
  }

  // Check for ioredis in lib
  const redisLibPath = join(projectRoot, "src/lib/redis")
  if (existsSync(redisLibPath)) {
    if (!stores.some((s) => s.name === "redis")) {
      scannedPaths.push("src/lib/redis")
      stores.push({
        name: "redis",
        storeType: "Redis",
        path: "src/lib/redis",
      })
    }
  }

  // Convert to ObservedComponents
  const components = stores.map((store) =>
    createObservedComponent(
      toComponentId("STORE", store.name),
      "STORE",
      `${store.storeType} Store`,
      [store.path],
      "config-reference",
      {
        storeType: store.storeType,
      }
    )
  )

  return {
    components,
    errors,
    metadata: {
      harvesterName: "harvest-stores",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      scanPaths: scannedPaths,
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestStores(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
