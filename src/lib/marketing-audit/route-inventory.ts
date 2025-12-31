import { promises as fs } from "node:fs"
import path from "node:path"
import { RouteEntry } from "./types"

const pagePattern = /page\.(tsx|ts|jsx|js)$/

function normalizeRoute(relativeDir: string) {
  if (!relativeDir) {
    return "/"
  }

  const cleaned = relativeDir.replace(/\\/g, "/").replace(/\(.*?\)\//g, "")

  return `/${cleaned}`
}

async function walk(dir: string, base: string, results: RouteEntry[]) {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      await walk(fullPath, base, results)
      continue
    }

    if (!pagePattern.test(entry.name)) {
      continue
    }

    const relDir = path.relative(base, path.dirname(fullPath))
    results.push({
      route: normalizeRoute(relDir),
      file: fullPath,
    })
  }
}

export async function buildRouteInventory(
  repoRoot: string,
  marketingRoot: string
): Promise<RouteEntry[]> {
  const base = path.resolve(repoRoot, marketingRoot)
  const results: RouteEntry[] = []

  await walk(base, base, results)
  return results
}
