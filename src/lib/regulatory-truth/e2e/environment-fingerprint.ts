// src/lib/regulatory-truth/e2e/environment-fingerprint.ts
// Collect and validate environment identity for E2E runs

import { createHash } from "crypto"
import { execSync } from "child_process"
import { existsSync } from "fs"
import { resolve } from "path"

export interface EnvironmentFingerprint {
  commitSha: string
  commitShort: string
  containerImage: string | null
  containerId: string | null
  dbMigrationHead: string
  envFingerprint: string
  agentCodeExists: boolean
  timestamp: string
  isValid: boolean
  invalidReason: string | null
}

/**
 * Collect environment fingerprint for E2E run validation.
 * If any critical field is missing, the run is marked INVALID.
 */
export async function collectEnvironmentFingerprint(): Promise<EnvironmentFingerprint> {
  const timestamp = new Date().toISOString()
  let isValid = true
  let invalidReason: string | null = null

  // Git commit SHA
  let commitSha = "unknown"
  let commitShort = "unknown"
  try {
    commitSha =
      process.env.COMMIT_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim()
    commitShort = commitSha.substring(0, 7)
  } catch {
    isValid = false
    invalidReason = "Cannot determine git commit SHA"
  }

  // Container image digest
  const containerImage = process.env.CONTAINER_IMAGE || process.env.COOLIFY_CONTAINER_NAME || null

  // Container ID
  const containerId = process.env.HOSTNAME || null

  // DB migration head
  let dbMigrationHead = "unknown"
  try {
    const result = execSync(
      "npx prisma migrate status 2>/dev/null | grep -E '^[0-9]+_' | tail -1 | cut -d' ' -f1",
      { encoding: "utf-8" }
    ).trim()
    dbMigrationHead = result || "unknown"

    if (dbMigrationHead === "unknown") {
      // Try alternative method
      const status = execSync("npx prisma migrate status 2>&1", { encoding: "utf-8" })
      if (status.includes("Database schema is up to date")) {
        dbMigrationHead = "up-to-date"
      }
    }
  } catch {
    // Migration check failed but not critical
    dbMigrationHead = "check-failed"
  }

  // Environment fingerprint (hash of key config, no secrets)
  const envKeys = [
    "NODE_ENV",
    "DATABASE_URL", // Will be hashed, not stored
    "OLLAMA_ENDPOINT",
    "WATCHDOG_TIMEZONE",
  ]
  const envValues = envKeys.map((k) => `${k}=${process.env[k] ? "SET" : "UNSET"}`).join("|")
  const envFingerprint = createHash("sha256").update(envValues).digest("hex").substring(0, 16)

  // Agent code presence check
  const agentPath = resolve(process.cwd(), "src/lib/regulatory-truth/agents")
  const agentCodeExists = existsSync(agentPath)

  if (!agentCodeExists) {
    isValid = false
    invalidReason = invalidReason || "Agent code not found"
  }

  return {
    commitSha,
    commitShort,
    containerImage,
    containerId,
    dbMigrationHead,
    envFingerprint,
    agentCodeExists,
    timestamp,
    isValid,
    invalidReason,
  }
}

/**
 * Print environment fingerprint header for logs.
 */
export function printFingerprintHeader(fp: EnvironmentFingerprint): void {
  console.log("╔══════════════════════════════════════════════════════════════════════╗")
  console.log("║                    LIVE E2E RUN ENVIRONMENT                          ║")
  console.log("╠══════════════════════════════════════════════════════════════════════╣")
  console.log(`║ Commit:      ${fp.commitSha.padEnd(54)} ║`)
  console.log(`║ Container:   ${(fp.containerImage || "N/A").substring(0, 54).padEnd(54)} ║`)
  console.log(`║ DB Head:     ${fp.dbMigrationHead.padEnd(54)} ║`)
  console.log(`║ Env Hash:    ${fp.envFingerprint.padEnd(54)} ║`)
  console.log(`║ Agent Code:  ${(fp.agentCodeExists ? "EXISTS" : "MISSING").padEnd(54)} ║`)
  console.log(`║ Timestamp:   ${fp.timestamp.padEnd(54)} ║`)
  console.log(
    `║ Valid:       ${(fp.isValid ? "YES" : `NO - ${fp.invalidReason}`).substring(0, 54).padEnd(54)} ║`
  )
  console.log("╚══════════════════════════════════════════════════════════════════════╝")
}

/**
 * Generate run folder path based on fingerprint.
 */
export function getRunFolderPath(fp: EnvironmentFingerprint): string {
  const date = fp.timestamp.split("T")[0]
  const containerId = fp.containerId || "local"
  return `docs/regulatory-truth/live-runs/${date}/${fp.commitShort}-${containerId}`
}
