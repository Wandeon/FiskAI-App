/**
 * Queues Harvester
 *
 * Deterministically scans for BullMQ queue definitions.
 * Discovery method: code-reference
 *
 * Scans for:
 * - Queue instantiations (new Queue())
 * - Queue name constants
 * - Export statements with "Queue" in name
 */

import { existsSync, readFileSync, readdirSync } from "fs"
import { join, relative } from "path"
import type { HarvesterResult, HarvesterError } from "./types"
import { createObservedComponent, toComponentId } from "./types"
import { ALLOWED_QUEUE_CONSTRUCTOR_PATHS } from "../governance"

// Regex patterns for queue detection
const QUEUE_PATTERNS = [
  // new Queue("name", ...)
  /new\s+Queue\s*\(\s*["']([^"']+)["']/g,
  // export const NAME_QUEUE = "name"
  /export\s+const\s+(\w+QUEUE\w*)\s*=\s*["']([^"']+)["']/gi,
  // Queue name from QUEUES object
  /(\w+):\s*["']([^"']+)["']/g,
]

interface QueueInfo {
  name: string
  path: string
  constName?: string
}

/**
 * Maximum number of files to scan when searching for queues.
 * Prevents runaway scans on large repos.
 */
const MAX_QUEUE_SCAN_FILES = 5000

/**
 * Validates that a queue name is a real queue name, not a variable or placeholder.
 */
function isValidQueueName(name: string): boolean {
  // Filter out obvious non-queue names
  if (!name || name.length < 2) return false
  if (name === "name" || name === "...") return false
  if (name.startsWith("$")) return false
  // Queue names should be simple lowercase identifiers
  return /^[a-z][a-z0-9-]*$/.test(name)
}

/**
 * Recursively collects .ts/.tsx files under a directory with a scan cap.
 */
function collectSourceFiles(dirPath: string, fileList: string[], hitLimit: { value: boolean }) {
  if (hitLimit.value) return

  const entries = readdirSync(dirPath, { withFileTypes: true })
  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    if (hitLimit.value) return
    const fullPath = join(dirPath, entry.name)

    if (entry.isDirectory()) {
      if (
        !entry.name.startsWith(".") &&
        !entry.name.startsWith("__") &&
        entry.name !== "node_modules"
      ) {
        collectSourceFiles(fullPath, fileList, hitLimit)
      }
      continue
    }

    if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      fileList.push(fullPath)
      if (fileList.length > MAX_QUEUE_SCAN_FILES) {
        hitLimit.value = true
        return
      }
    }
  }
}

/**
 * Extracts queue names and constructor usage from a TypeScript file.
 */
function parseQueueFile(
  filePath: string,
  projectRoot: string
): { queues: QueueInfo[]; hasQueueConstructor: boolean } {
  const queues: QueueInfo[] = []
  const seen = new Set<string>()

  if (!existsSync(filePath)) {
    return { queues, hasQueueConstructor: false }
  }

  const content = readFileSync(filePath, "utf-8")
  const relativePath = relative(projectRoot, filePath)

  const hasQueueConstructor = /new\s+Queue\s*(<[^>]+>)?\s*\(/.test(content)

  // Pattern 1: createQueue("name", ...) - factory pattern
  const createQueuePattern = /createQueue\s*\(\s*["']([^"']+)["']/g
  let match
  while ((match = createQueuePattern.exec(content)) !== null) {
    const name = match[1]
    if (!seen.has(name) && isValidQueueName(name)) {
      seen.add(name)
      queues.push({ name, path: relativePath })
    }
  }

  // Pattern 2: new Queue("name", ...)
  const newQueuePattern = /new\s+Queue\s*\(\s*["']([^"']+)["']/g
  while ((match = newQueuePattern.exec(content)) !== null) {
    const name = match[1]
    if (!seen.has(name) && isValidQueueName(name)) {
      seen.add(name)
      queues.push({ name, path: relativePath })
    }
  }

  // Pattern 3: QUEUES = { sentinel: "sentinel", ... }
  const queuesObjectMatch = content.match(/QUEUES\s*=\s*\{([\s\S]*?)\}/)
  if (queuesObjectMatch) {
    const objectContent = queuesObjectMatch[1]
    const entryPattern = /(\w+):\s*["']([^"']+)["']/g
    while ((match = entryPattern.exec(objectContent)) !== null) {
      const name = match[2]
      if (!seen.has(name) && isValidQueueName(name)) {
        seen.add(name)
        queues.push({ name, path: relativePath, constName: match[1] })
      }
    }
  }

  // Pattern 4: export const QUEUE_NAME = "..."
  const exportPattern = /export\s+const\s+(\w+)\s*=\s*["']([^"']+)["']/g
  while ((match = exportPattern.exec(content)) !== null) {
    if (match[1].toLowerCase().includes("queue")) {
      const name = match[2]
      if (!seen.has(name) && isValidQueueName(name)) {
        seen.add(name)
        queues.push({ name, path: relativePath, constName: match[1] })
      }
    }
  }

  return { queues, hasQueueConstructor }
}

/**
 * Harvests all queues from known queue definition files.
 */
export async function harvestQueues(projectRoot: string): Promise<HarvesterResult> {
  const startTime = Date.now()
  const errors: HarvesterError[] = []
  const allQueues: QueueInfo[] = []
  const seen = new Set<string>()
  const scannedPaths: string[] = []

  const libPath = join(projectRoot, "src/lib")
  if (!existsSync(libPath)) {
    return {
      components: [],
      errors: [
        {
          path: libPath,
          message: "src/lib directory does not exist",
          recoverable: false,
        },
      ],
      metadata: {
        harvesterName: "harvest-queues",
        executedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        scanPaths: ["src/lib"],
      },
    }
  }

  scannedPaths.push("src/lib")
  const queueFiles: string[] = []
  const hitLimit = { value: false }
  collectSourceFiles(libPath, queueFiles, hitLimit)

  if (hitLimit.value) {
    errors.push({
      path: "src/lib",
      message: `Queue scan exceeded file limit (${MAX_QUEUE_SCAN_FILES})`,
      recoverable: false,
    })
  }

  for (const filePath of queueFiles) {
    const { queues, hasQueueConstructor } = parseQueueFile(filePath, projectRoot)
    const relativePath = relative(projectRoot, filePath)

    if (
      hasQueueConstructor &&
      !ALLOWED_QUEUE_CONSTRUCTOR_PATHS.includes(
        relativePath as (typeof ALLOWED_QUEUE_CONSTRUCTOR_PATHS)[number]
      )
    ) {
      errors.push({
        path: relativePath,
        message: "Queue constructor used outside allowed factory file",
        recoverable: false,
      })
    }

    for (const q of queues) {
      if (!seen.has(q.name)) {
        seen.add(q.name)
        allQueues.push(q)
      }
    }
  }

  // Convert to ObservedComponents
  const components = allQueues.map((queue) =>
    createObservedComponent(
      toComponentId("QUEUE", queue.name),
      "QUEUE",
      `${queue.name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")} Queue`,
      [queue.path],
      "code-reference",
      queue.constName ? { constName: queue.constName } : undefined
    )
  )

  return {
    components,
    errors,
    metadata: {
      harvesterName: "harvest-queues",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      scanPaths: scannedPaths,
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestQueues(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
