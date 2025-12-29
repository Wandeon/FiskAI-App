/**
 * Integrations Harvester
 *
 * Deterministically scans for external integration wrappers.
 * Discovery method: directory-exists, env-usage, code-reference
 *
 * IMPORTANT: Integration patterns are controlled by governance.ts.
 * Changes to patterns require CODEOWNERS approval.
 *
 * Also detects UNKNOWN integrations based on:
 * - Environment variable patterns in .env.example
 * - Package.json dependencies matching SaaS patterns
 * - src/lib directories containing integration-like files
 *
 * Unknown integrations are flagged as WARN-level observations.
 */

import { existsSync, readFileSync, readdirSync } from "fs"
import { join, relative } from "path"
import type { HarvesterResult, HarvesterError } from "./types"
import { createObservedComponent, toComponentId } from "./types"
import {
  INTEGRATION_PATTERNS,
  INTEGRATION_ENV_SUFFIXES,
  INTEGRATION_FILE_PATTERNS,
  INTERNAL_ENV_PREFIXES,
  INTERNAL_LIB_DIRECTORIES,
} from "../governance"

interface IntegrationInfo {
  name: string
  displayName: string
  path: string
  discoveryMethod: "directory-exists" | "env-usage" | "code-reference"
  isUnknown?: boolean
}

/**
 * Extracts env var prefix from a line like "STRIPE_API_KEY=..."
 */
function extractEnvPrefix(line: string): string | null {
  const match = line.match(/^([A-Z][A-Z0-9_]+)=/)
  if (!match) return null
  const key = match[1]

  // Check if it ends with a known integration suffix
  for (const suffix of INTEGRATION_ENV_SUFFIXES) {
    if (key.endsWith(suffix)) {
      // Return the prefix (everything before the suffix)
      return key.slice(0, -suffix.length)
    }
  }

  return null
}

/**
 * Checks if a directory looks like an integration wrapper.
 */
function looksLikeIntegration(dirPath: string): boolean {
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })
    const fileNames = entries.filter((e) => e.isFile()).map((e) => e.name)

    // Check for integration-like files
    for (const pattern of INTEGRATION_FILE_PATTERNS) {
      if (fileNames.some((f) => f === pattern || f.endsWith(`.${pattern}`))) {
        return true
      }
    }

    return false
  } catch {
    return false
  }
}

/**
 * Harvests all integrations from project.
 */
export async function harvestIntegrations(projectRoot: string): Promise<HarvesterResult> {
  const startTime = Date.now()
  const errors: HarvesterError[] = []
  const integrations: IntegrationInfo[] = []
  const seen = new Set<string>()
  const scannedPaths: string[] = []

  // Build known integration lookup
  const knownPatterns = new Map<
    string,
    { displayName: string; envPrefix?: string; packageName?: string; directoryAliases?: string[] }
  >()
  for (const pattern of INTEGRATION_PATTERNS) {
    knownPatterns.set(pattern.key, {
      displayName: pattern.displayName,
      envPrefix: pattern.envPrefix,
      packageName: pattern.packageName,
      directoryAliases: pattern.directoryAliases,
    })
  }

  // Method 1: Check for wrapper directories in src/lib/
  const libPath = join(projectRoot, "src/lib")
  if (existsSync(libPath)) {
    scannedPaths.push("src/lib")
    const entries = readdirSync(libPath, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue

      const lowerName = entry.name.toLowerCase()
      const dirPath = join(libPath, entry.name)

      // Check if it matches a known integration
      let matched = false
      for (const [key, info] of knownPatterns.entries()) {
        // Check key match
        const keyMatch =
          lowerName === key || (lowerName.includes(key) && lowerName.length <= key.length + 5)
        // Check directory aliases
        const aliasMatch = info.directoryAliases?.some(
          (alias) =>
            lowerName === alias ||
            (lowerName.includes(alias) && lowerName.length <= alias.length + 5)
        )

        if (keyMatch || aliasMatch) {
          if (!seen.has(key)) {
            seen.add(key)
            integrations.push({
              name: key,
              displayName: info.displayName,
              path: relative(projectRoot, dirPath),
              discoveryMethod: "directory-exists",
            })
            matched = true
          }
        }
      }

      // If not matched but looks like an integration, flag as unknown
      // Skip internal library directories that aren't external integrations
      const isInternalLib = INTERNAL_LIB_DIRECTORIES.includes(lowerName)
      if (!matched && !isInternalLib && looksLikeIntegration(dirPath)) {
        const unknownKey = `unknown-${entry.name}`
        if (!seen.has(unknownKey)) {
          seen.add(unknownKey)
          integrations.push({
            name: unknownKey,
            displayName: `Unknown: ${entry.name}`,
            path: relative(projectRoot, dirPath),
            discoveryMethod: "directory-exists",
            isUnknown: true,
          })
        }
      }
    }
  }

  // Method 2: Check .env.example for integration env vars
  const envExamplePath = join(projectRoot, ".env.example")
  if (existsSync(envExamplePath)) {
    scannedPaths.push(".env.example")
    try {
      const content = readFileSync(envExamplePath, "utf-8")
      const lines = content.split("\n")

      // Check known integrations
      for (const [key, info] of knownPatterns.entries()) {
        if (info.envPrefix && !seen.has(key)) {
          const hasEnvVar = lines.some(
            (line) => line.startsWith(info.envPrefix!) && !line.startsWith("#")
          )
          if (hasEnvVar) {
            seen.add(key)
            integrations.push({
              name: key,
              displayName: info.displayName,
              path: ".env.example",
              discoveryMethod: "env-usage",
            })
          }
        }
      }

      // Check for unknown integrations via env patterns
      for (const line of lines) {
        if (line.startsWith("#") || !line.includes("=")) continue

        const prefix = extractEnvPrefix(line)
        if (!prefix) continue

        // Skip internal framework/platform env prefixes
        const envKey = line.split("=")[0]
        const isInternalPrefix = INTERNAL_ENV_PREFIXES.some((p) => envKey.startsWith(p))
        if (isInternalPrefix) continue

        // Check if this prefix matches any known integration
        const isKnown = INTEGRATION_PATTERNS.some(
          (p) => p.envPrefix && line.startsWith(p.envPrefix)
        )

        if (!isKnown) {
          const unknownKey = `unknown-env-${prefix.toLowerCase()}`
          if (!seen.has(unknownKey)) {
            seen.add(unknownKey)
            integrations.push({
              name: unknownKey,
              displayName: `Unknown (env: ${prefix}_*)`,
              path: `.env.example (${envKey})`,
              discoveryMethod: "env-usage",
              isUnknown: true,
            })
          }
        }
      }
    } catch (e) {
      errors.push({
        path: envExamplePath,
        message: `Failed to read .env.example: ${e instanceof Error ? e.message : String(e)}`,
        recoverable: true,
      })
    }
  }

  // Method 3: Check package.json for known integration packages
  const packageJsonPath = join(projectRoot, "package.json")
  if (existsSync(packageJsonPath)) {
    scannedPaths.push("package.json")
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      }

      for (const [key, info] of knownPatterns.entries()) {
        if (info.packageName && deps[info.packageName] && !seen.has(key)) {
          seen.add(key)
          integrations.push({
            name: key,
            displayName: info.displayName,
            path: `package.json (${info.packageName})`,
            discoveryMethod: "code-reference",
          })
        }
      }

      // Check for common SaaS SDK patterns not in known list
      const saasPatterns = [
        { pattern: /@(?:stripe|paypal|square|adyen)/i, name: "payment" },
        { pattern: /@(?:twilio|messagebird|vonage)/i, name: "sms" },
        { pattern: /@(?:sendgrid|mailgun|mailchimp)/i, name: "email" },
        { pattern: /@(?:algolia|elasticsearch|meilisearch)/i, name: "search" },
        { pattern: /@(?:auth0|okta|clerk)/i, name: "auth" },
        { pattern: /@(?:datadog|newrelic|dynatrace)/i, name: "monitoring" },
        { pattern: /@(?:amplitude|mixpanel|segment)/i, name: "analytics" },
      ]

      for (const dep of Object.keys(deps)) {
        // Skip if already detected
        const isKnown = INTEGRATION_PATTERNS.some((p) => p.packageName === dep)
        if (isKnown) continue

        for (const { pattern, name } of saasPatterns) {
          if (pattern.test(dep)) {
            const unknownKey = `unknown-pkg-${name}-${dep.replace(/[^a-z0-9]/gi, "-")}`
            if (!seen.has(unknownKey)) {
              seen.add(unknownKey)
              integrations.push({
                name: unknownKey,
                displayName: `Unknown ${name}: ${dep}`,
                path: `package.json (${dep})`,
                discoveryMethod: "code-reference",
                isUnknown: true,
              })
            }
            break
          }
        }
      }
    } catch (e) {
      errors.push({
        path: packageJsonPath,
        message: `Failed to parse package.json: ${e instanceof Error ? e.message : String(e)}`,
        recoverable: true,
      })
    }
  }

  // Convert to ObservedComponents
  const components = integrations.map((int) =>
    createObservedComponent(
      toComponentId("INTEGRATION", int.name),
      "INTEGRATION",
      int.displayName,
      [int.path],
      int.discoveryMethod,
      int.isUnknown ? { isUnknown: true, requiresReview: true } : undefined
    )
  )

  return {
    components,
    errors,
    metadata: {
      harvesterName: "harvest-integrations",
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      scanPaths: scannedPaths,
    },
  }
}

// CLI entry point
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd()
  harvestIntegrations(projectRoot).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}
