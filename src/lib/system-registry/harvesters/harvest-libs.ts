/**
 * Libraries Harvester
 *
 * Deterministically scans src/lib/ for library directories.
 * Discovery method: directory-exists
 *
 * A library is any directory under src/lib/ that:
 * - Contains at least one .ts file
 * - Is not excluded in governance.ts
 *
 * IMPORTANT: Exclusions are controlled by governance.ts, not hardcoded here.
 * Changes to exclusions require CODEOWNERS approval.
 */

import { existsSync, readdirSync } from "fs"
import { join, relative } from "path"
import type { HarvesterResult, HarvesterError } from "./types"
import { createObservedComponent, toComponentId } from "./types"
import { getLibExclusions } from "../governance"

const LIB_ROOT = "src/lib"

interface LibInfo {
  name: string
  path: string
  fileCount: number
}

interface ScanState {
  count: number
  hitLimit: boolean
}

/**
 * Maximum depth to scan for .ts files when checking if a directory is a library.
 * Prevents full repo crawl while catching common nested structures like:
 * - src/lib/foo/src/*.ts
 * - src/lib/foo/server/*.ts
 * - src/lib/foo/client/*.ts
 */
const MAX_LIBRARY_SCAN_DEPTH = 3

/**
 * Maximum files to scan per directory level to prevent performance issues.
 */
const MAX_FILES_PER_LEVEL = 50

/**
 * Checks if a directory contains TypeScript files, with bounded recursion.
 * Returns true if ANY .ts/.tsx file is found within the depth limit.
 */
function hasTsFiles(dirPath: string, depth: number, state: ScanState): boolean {
  if (state.hitLimit) return false
  if (depth > MAX_LIBRARY_SCAN_DEPTH) return false
  if (state.count > MAX_FILES_PER_LEVEL * MAX_LIBRARY_SCAN_DEPTH) {
    state.hitLimit = true
    return false
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      state.count++
      if (state.count > MAX_FILES_PER_LEVEL * MAX_LIBRARY_SCAN_DEPTH) {
        state.hitLimit = true
        return false
      }

      if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
        // Skip type definition files (.d.ts) - they don't indicate real library code
        if (entry.name.endsWith(".d.ts")) continue
        return true
      }

      // Skip symlinks to prevent loops
      if (entry.isSymbolicLink()) continue

      if (
        entry.isDirectory() &&
        !entry.name.startsWith("__") &&
        !entry.name.startsWith(".") &&
        entry.name !== "node_modules"
      ) {
        if (hasTsFiles(join(dirPath, entry.name), depth + 1, state)) {
          return true
        }
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * Checks if a directory is a valid library.
 * Uses bounded recursive scan to catch nested structures.
 */
function isLibrary(dirPath: string, state: ScanState): boolean {
  return hasTsFiles(dirPath, 0, state)
}

/**
 * Counts TypeScript files in a directory with bounded traversal.
 * Uses same safety rules as hasTsFiles() to prevent:
 * - Unbounded recursion
 * - Symlink loops
 * - Counting noise (node_modules, dot dirs, .d.ts, generated files)
 */
function countTsFiles(dirPath: string, depth: number, state: ScanState): number {
  // Same bounds as hasTsFiles()
  if (state.hitLimit) return 0
  if (depth > MAX_LIBRARY_SCAN_DEPTH) return 0
  if (state.count > MAX_FILES_PER_LEVEL * MAX_LIBRARY_SCAN_DEPTH) {
    state.hitLimit = true
    return 0
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    let count = 0

    for (const entry of entries) {
      state.count++
      if (state.count > MAX_FILES_PER_LEVEL * MAX_LIBRARY_SCAN_DEPTH) {
        state.hitLimit = true
        return 0
      }

      // Skip symlinks to prevent loops
      if (entry.isSymbolicLink()) continue

      if (entry.isFile()) {
        // Count .ts/.tsx but not .d.ts (type definitions are not real code)
        if (
          (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
          !entry.name.endsWith(".d.ts")
        ) {
          count++
        }
      } else if (entry.isDirectory()) {
        // Same exclusions as hasTsFiles()
        if (
          entry.name.startsWith("__") ||
          entry.name.startsWith(".") ||
          entry.name === "node_modules"
        ) {
          continue
        }
        count += countTsFiles(join(dirPath, entry.name), depth + 1, state)
      }
    }

    return count
  } catch {
    return 0
  }
}

/**
 * Harvests all libraries from src/lib/.
 */
export async function harvestLibs(projectRoot: string): Promise<HarvesterResult> {
  const startTime = Date.now()
  const errors: HarvesterError[] = []
  const libs: LibInfo[] = []

  const libRoot = join(projectRoot, LIB_ROOT)

  if (!existsSync(libRoot)) {
    return {
      components: [],
      errors: [
        {
          path: libRoot,
          message: "lib root directory does not exist",
          recoverable: false,
        },
      ],
      metadata: {
        harvesterName: "harvest-libs",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        scanPaths: [LIB_ROOT],
      },
    }
  }

  // Get exclusions from governance
  const excludedDirs = getLibExclusions()

  // Get top-level directories
  const entries = readdirSync(libRoot, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue
    if (excludedDirs.includes(entry.name)) continue

    const libPath = join(libRoot, entry.name)

    const hasState: ScanState = { count: 0, hitLimit: false }
    const isLib = isLibrary(libPath, hasState)
    if (hasState.hitLimit) {
      errors.push({
        path: relative(projectRoot, libPath),
        message: `Library scan exceeded file limit (${MAX_FILES_PER_LEVEL * MAX_LIBRARY_SCAN_DEPTH})`,
        recoverable: false,
      })
    }

    if (isLib) {
      const countState: ScanState = { count: 0, hitLimit: false }
      libs.push({
        name: entry.name,
        path: relative(projectRoot, libPath),
        fileCount: countTsFiles(libPath, 0, countState),
      })
      if (countState.hitLimit) {
        errors.push({
          path: relative(projectRoot, libPath),
          message: `Library scan exceeded file limit (${MAX_FILES_PER_LEVEL * MAX_LIBRARY_SCAN_DEPTH})`,
          recoverable: false,
        })
      }
    }
  }

  // Convert to ObservedComponents
  const components = libs.map((lib) =>
    createObservedComponent(
      toComponentId("LIB", lib.name),
      "LIB",
      `${lib.name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")} Library`,
      [lib.path],
      "directory-exists",
      {
        fileCount: lib.fileCount,
      }
    )
  )

  return {
    components,
    errors,
    metadata: {
      harvesterName: "harvest-libs",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      scanPaths: [LIB_ROOT],
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestLibs(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
