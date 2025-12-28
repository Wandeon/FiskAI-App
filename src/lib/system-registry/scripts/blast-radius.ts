#!/usr/bin/env npx tsx
/**
 * Blast Radius CLI
 *
 * Computes the blast radius for a PR by analyzing changed files and their
 * impact on system components. This is the CI entry point for change intelligence.
 *
 * Usage:
 *   npx tsx src/lib/system-registry/scripts/blast-radius.ts \
 *     --base-sha <sha> \
 *     --head-sha <sha> \
 *     --output-format [pr-comment|github-check|json] \
 *     --enforcement-mode [warn|fail] \
 *     --write-comment  # Write to docs/system-registry/blast-radius-comment.json
 *
 * Exit codes:
 *   0 - LOW/MEDIUM score (always), HIGH/CRITICAL in warn mode
 *   1 - HIGH score in fail mode
 *   2 - CRITICAL score in fail mode, or argument/git errors
 */

import { execSync } from "child_process"
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"

import { buildGraph } from "../dependency-graph"
import {
  computeDirectImpact,
  computeTransitiveImpact,
  computeCriticalPathImpacts,
  computeBlastScore,
  type Criticality,
  type DirectImpact,
  type TransitiveImpact,
  type CriticalPathImpact,
  type BlastScore,
} from "../blast-radius"
import { ALL_COMPONENTS, CRITICAL_PATHS } from "../declarations"
import { formatPRComment, type BlastAnalysis } from "../formatters/pr-comment"
import { formatGitHubCheck, type EnforcementMode } from "../formatters/github-check"

// =============================================================================
// Types
// =============================================================================

type OutputFormat = "pr-comment" | "github-check" | "json"

interface CLIOptions {
  baseSha: string
  headSha: string
  outputFormat: OutputFormat
  enforcementMode: EnforcementMode
  writeComment: boolean
  projectRoot: string
}

interface BlastRadiusResult {
  changedFiles: string[]
  directImpacts: DirectImpact[]
  transitiveImpacts: TransitiveImpact[]
  criticalPathImpacts: CriticalPathImpact[]
  blastScore: BlastScore
  owners: string[]
  truncated: boolean
}

// =============================================================================
// Argument Parsing
// =============================================================================

function printUsage(): void {
  console.error(`
Usage: npx tsx blast-radius.ts [options]

Required:
  --base-sha <sha>         Base commit SHA for diff
  --head-sha <sha>         Head commit SHA for diff

Options:
  --output-format <format>   Output format: pr-comment, github-check, json (default: pr-comment)
  --enforcement-mode <mode>  Enforcement mode: warn, fail
                             Default: BLAST_RADIUS_ENFORCEMENT_MODE env var, or 'warn'
  --write-comment            Write output to docs/system-registry/blast-radius-comment.json

Environment Variables:
  BLAST_RADIUS_ENFORCEMENT_MODE   Default enforcement mode when --enforcement-mode not provided
                                  Values: warn, fail (default: warn)

Exit codes:
  0  LOW/MEDIUM score, or HIGH/CRITICAL in warn mode
  1  HIGH score in fail mode
  2  CRITICAL score in fail mode, or argument/git errors
`)
}

/**
 * Gets the default enforcement mode from environment variable.
 * Falls back to 'warn' if not set or invalid.
 */
function getDefaultEnforcementMode(): EnforcementMode {
  const envMode = process.env.BLAST_RADIUS_ENFORCEMENT_MODE?.toLowerCase()
  if (envMode === "fail") {
    return "fail"
  }
  // Default to 'warn' for any other value (including undefined, empty, or invalid)
  return "warn"
}

function parseArgs(): CLIOptions | null {
  const args = process.argv.slice(2)
  const defaultEnforcementMode = getDefaultEnforcementMode()
  const options: Partial<CLIOptions> = {
    outputFormat: "pr-comment",
    enforcementMode: defaultEnforcementMode,
    writeComment: false,
    projectRoot: process.cwd(),
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case "--base-sha":
        options.baseSha = args[++i]
        break
      case "--head-sha":
        options.headSha = args[++i]
        break
      case "--output-format": {
        const format = args[++i]
        if (!["pr-comment", "github-check", "json"].includes(format)) {
          console.error(`Error: Invalid --output-format "${format}". Must be: pr-comment, github-check, json`)
          return null
        }
        options.outputFormat = format as OutputFormat
        break
      }
      case "--enforcement-mode": {
        const mode = args[++i]
        if (!["warn", "fail"].includes(mode)) {
          console.error(`Error: Invalid --enforcement-mode "${mode}". Must be: warn, fail`)
          return null
        }
        options.enforcementMode = mode as EnforcementMode
        break
      }
      case "--write-comment":
        options.writeComment = true
        break
      case "--help":
      case "-h":
        printUsage()
        return null
      default:
        if (!arg.startsWith("--")) {
          // Positional arg - treat as project root
          options.projectRoot = arg
        } else {
          console.error(`Error: Unknown option "${arg}"`)
          return null
        }
    }
  }

  // Validate required args
  if (!options.baseSha) {
    console.error("Error: --base-sha is required")
    printUsage()
    return null
  }

  if (!options.headSha) {
    console.error("Error: --head-sha is required")
    printUsage()
    return null
  }

  return options as CLIOptions
}

// =============================================================================
// Git Operations
// =============================================================================

/**
 * Gets changed files between two commits using git diff.
 * Returns null if git command fails (invalid shas, shallow clone, etc.)
 */
function getChangedFiles(baseSha: string, headSha: string, cwd: string): string[] | null {
  try {
    // First, verify both commits exist
    try {
      execSync(`git cat-file -e ${baseSha}`, { cwd, stdio: "pipe" })
    } catch {
      console.error(`Error: Base commit "${baseSha}" not found.`)
      console.error("This may happen in a shallow clone. Try fetching more history:")
      console.error("  git fetch --unshallow")
      console.error("  # or")
      console.error("  git fetch --depth=100")
      return null
    }

    try {
      execSync(`git cat-file -e ${headSha}`, { cwd, stdio: "pipe" })
    } catch {
      console.error(`Error: Head commit "${headSha}" not found.`)
      console.error("This may happen in a shallow clone. Try fetching more history:")
      console.error("  git fetch --unshallow")
      return null
    }

    // Get the diff
    const result = execSync(`git diff --name-only ${baseSha}...${headSha}`, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    const files = result
      .trim()
      .split("\n")
      .filter((f) => f.length > 0)

    return files
  } catch (error: unknown) {
    const execError = error as { message?: string; stderr?: string }
    console.error("Error: Failed to get git diff")
    if (execError.stderr) {
      console.error(execError.stderr)
    } else if (execError.message) {
      console.error(execError.message)
    }
    console.error("")
    console.error("Common causes:")
    console.error("  - Invalid commit SHA")
    console.error("  - Shallow clone missing required history")
    console.error("  - Not in a git repository")
    return null
  }
}

// =============================================================================
// Blast Radius Computation
// =============================================================================

/**
 * Collects unique owners from direct impacts.
 */
function collectOwners(directImpacts: DirectImpact[]): string[] {
  const owners = new Set<string>()
  for (const impact of directImpacts) {
    if (impact.component.owner) {
      owners.add(impact.component.owner)
    }
  }
  return Array.from(owners).sort()
}

/**
 * Computes the full blast radius analysis.
 */
function computeBlastRadius(changedFiles: string[]): BlastRadiusResult {
  // Step 1: Compute direct impacts
  const directImpacts = computeDirectImpact(changedFiles, ALL_COMPONENTS)

  // Step 2: Build dependency graph and compute transitive impacts
  const graph = buildGraph(ALL_COMPONENTS)
  const directComponentIds = directImpacts.map((d) => d.component.componentId)
  const { impacts: transitiveImpacts, truncated } = computeTransitiveImpact(
    directComponentIds,
    graph,
    ALL_COMPONENTS
  )

  // Step 3: Compute critical path impacts
  const criticalPathImpacts = computeCriticalPathImpacts(
    directComponentIds,
    transitiveImpacts,
    CRITICAL_PATHS
  )

  // Step 4: Compute blast score
  // For now, we pass empty governance issues - could integrate with governance.ts later
  const blastScore = computeBlastScore(directImpacts, criticalPathImpacts, [])

  // Step 5: Collect owners
  const owners = collectOwners(directImpacts)

  return {
    changedFiles,
    directImpacts,
    transitiveImpacts,
    criticalPathImpacts,
    blastScore,
    owners,
    truncated,
  }
}

// =============================================================================
// Output Formatting
// =============================================================================

/**
 * Formats the result based on output format.
 */
function formatOutput(
  result: BlastRadiusResult,
  outputFormat: OutputFormat,
  enforcementMode: EnforcementMode
): string {
  const analysis: BlastAnalysis = {
    directImpacts: result.directImpacts,
    transitiveImpacts: result.transitiveImpacts,
    criticalPathImpacts: result.criticalPathImpacts,
    score: result.blastScore,
    owners: result.owners,
    truncated: result.truncated,
  }

  switch (outputFormat) {
    case "pr-comment":
      return formatPRComment(analysis)

    case "github-check":
      return JSON.stringify(formatGitHubCheck(analysis, enforcementMode), null, 2)

    case "json":
      return JSON.stringify(
        {
          schemaVersion: "1.0.0",
          changedFiles: result.changedFiles,
          directImpacts: result.directImpacts.map((d) => ({
            componentId: d.component.componentId,
            type: d.component.type,
            criticality: d.component.criticality,
            matchedFiles: d.matchedFiles,
            matchType: d.matchType,
          })),
          transitiveImpacts: result.transitiveImpacts.map((t) => ({
            componentId: t.component.componentId,
            type: t.component.type,
            criticality: t.component.criticality,
            distance: t.distance,
            pathThrough: t.pathThrough,
          })),
          criticalPathImpacts: result.criticalPathImpacts.map((p) => ({
            pathId: p.pathId,
            pathName: p.pathName,
            distance: p.distance,
            impactedComponents: p.impactedComponents,
          })),
          blastScore: result.blastScore,
          owners: result.owners,
          truncated: result.truncated,
          summary: {
            changedFilesCount: result.changedFiles.length,
            directImpactsCount: result.directImpacts.length,
            transitiveImpactsCount: result.transitiveImpacts.length,
            criticalPathsAffected: result.criticalPathImpacts.length,
            score: result.blastScore.score,
          },
        },
        null,
        2
      )

    default:
      return formatPRComment(analysis)
  }
}

// =============================================================================
// Exit Code Determination
// =============================================================================

/**
 * Determines exit code based on blast score and enforcement mode.
 *
 * Exit codes:
 *   0 - LOW/MEDIUM (always), or HIGH/CRITICAL in warn mode
 *   1 - HIGH in fail mode
 *   2 - CRITICAL in fail mode
 */
function getExitCode(score: Criticality, enforcementMode: EnforcementMode): number {
  if (enforcementMode === "warn") {
    // In warn mode, always exit 0
    return 0
  }

  // In fail mode, exit code depends on score
  switch (score) {
    case "LOW":
    case "MEDIUM":
      return 0
    case "HIGH":
      return 1
    case "CRITICAL":
      return 2
    default:
      return 0
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  // Parse arguments
  const options = parseArgs()
  if (!options) {
    process.exit(2)
  }

  console.error("Blast Radius Analysis")
  console.error("=====================")
  console.error("")
  console.error(`Base SHA: ${options.baseSha}`)
  console.error(`Head SHA: ${options.headSha}`)
  console.error(`Output Format: ${options.outputFormat}`)
  const envMode = process.env.BLAST_RADIUS_ENFORCEMENT_MODE
  const modeSource = envMode ? `env: BLAST_RADIUS_ENFORCEMENT_MODE=${envMode}` : "default"
  console.error(`Enforcement Mode: ${options.enforcementMode} (${modeSource})`)
  console.error("")

  // Get changed files
  console.error("Getting changed files...")
  const changedFiles = getChangedFiles(options.baseSha, options.headSha, options.projectRoot)
  if (changedFiles === null) {
    process.exit(2)
  }

  console.error(`Found ${changedFiles.length} changed file(s)`)
  console.error("")

  // Handle empty diff
  if (changedFiles.length === 0) {
    console.error("No files changed - computing minimal blast radius")
  }

  // Compute blast radius
  console.error("Computing blast radius...")
  const result = computeBlastRadius(changedFiles)

  console.error(`Direct impacts: ${result.directImpacts.length}`)
  console.error(`Transitive impacts: ${result.transitiveImpacts.length}`)
  console.error(`Critical paths affected: ${result.criticalPathImpacts.length}`)
  console.error(`Blast score: ${result.blastScore.score}`)
  if (result.blastScore.bumps.length > 0) {
    console.error(`  (bumped from ${result.blastScore.baseScore})`)
  }
  console.error("")

  // Format output
  const output = formatOutput(result, options.outputFormat, options.enforcementMode)

  // Write to file if requested
  if (options.writeComment) {
    const outputPath = join(options.projectRoot, "docs/system-registry/blast-radius-comment.json")
    console.error(`Writing output to: ${outputPath}`)

    // Ensure directory exists
    mkdirSync(dirname(outputPath), { recursive: true })

    // Always write JSON for the comment file
    const jsonOutput =
      options.outputFormat === "json"
        ? output
        : JSON.stringify(
            {
              format: options.outputFormat,
              content: output,
              metadata: {
                baseSha: options.baseSha,
                headSha: options.headSha,
                executedAt: new Date().toISOString(),
                score: result.blastScore.score,
              },
            },
            null,
            2
          )

    writeFileSync(outputPath, jsonOutput)
    console.error("")
  }

  // Output to stdout
  console.log(output)

  // Determine exit code
  const exitCode = getExitCode(result.blastScore.score, options.enforcementMode)

  if (exitCode === 0) {
    console.error("")
    console.error(`Blast radius check PASSED (score: ${result.blastScore.score})`)
  } else {
    console.error("")
    console.error(`Blast radius check FAILED (score: ${result.blastScore.score})`)
    if (options.enforcementMode === "fail") {
      console.error("Enforcement mode is 'fail' - blocking merge")
    }
  }

  process.exit(exitCode)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(2)
})
