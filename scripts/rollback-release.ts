// scripts/rollback-release.ts
/**
 * Release Rollback Script
 *
 * Safely rollback a regulatory rules release to its previous state.
 * This is an atomic operation - if any part fails, no changes are made.
 *
 * Usage:
 *   npx tsx scripts/rollback-release.ts <version>
 *   npx tsx scripts/rollback-release.ts <version> --dry-run
 *   npx tsx scripts/rollback-release.ts <version> --force
 *
 * Examples:
 *   npx tsx scripts/rollback-release.ts 1.2.0           # Rollback with confirmation
 *   npx tsx scripts/rollback-release.ts 1.2.0 --dry-run # Show what would happen
 *   npx tsx scripts/rollback-release.ts 1.2.0 --force   # Skip confirmation
 *
 * Exit codes:
 *   0 - Success (or dry run completed)
 *   1 - Rollback failed or validation errors
 *   2 - User cancelled
 */

import { config } from "dotenv"
import * as readline from "readline"

// Load environment variables
config({ path: ".env.local" })
config({ path: ".env" })

import { prisma } from "@/lib/prisma"
import {
  validateRollback,
  rollbackRelease,
  type RollbackValidation,
} from "@/lib/regulatory-truth/agents/releaser"

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
}

function printHeader() {
  console.log(`${colors.bold}${colors.cyan}=== Regulatory Release Rollback ===${colors.reset}\n`)
  console.log(`${colors.dim}Timestamp: ${new Date().toISOString()}${colors.reset}\n`)
}

function printValidation(validation: RollbackValidation) {
  console.log(`${colors.bold}Validation Results:${colors.reset}`)

  if (validation.targetRelease) {
    console.log(`\n${colors.blue}Target Release:${colors.reset}`)
    console.log(`  Version: ${colors.bold}${validation.targetRelease.version}${colors.reset}`)
    console.log(`  Released: ${validation.targetRelease.releasedAt.toISOString()}`)
    console.log(`  Rules to rollback: ${validation.targetRelease.ruleCount}`)
  }

  if (validation.previousRelease) {
    console.log(`\n${colors.blue}Previous Release (target state):${colors.reset}`)
    console.log(`  Version: ${colors.bold}${validation.previousRelease.version}${colors.reset}`)
    console.log(`  Rule count: ${validation.previousRelease.ruleCount}`)
  } else {
    console.log(
      `\n${colors.yellow}No previous release. Rules will revert to APPROVED status.${colors.reset}`
    )
  }

  if (validation.warnings.length > 0) {
    console.log(`\n${colors.yellow}Warnings:${colors.reset}`)
    for (const warning of validation.warnings) {
      console.log(`  ${colors.yellow}[!]${colors.reset} ${warning}`)
    }
  }

  if (validation.errors.length > 0) {
    console.log(`\n${colors.red}Errors:${colors.reset}`)
    for (const error of validation.errors) {
      console.log(`  ${colors.red}[X]${colors.reset} ${error}`)
    }
  }

  console.log(
    `\n${colors.bold}Can Rollback: ${colors.reset}${validation.canRollback ? `${colors.green}YES${colors.reset}` : `${colors.red}NO${colors.reset}`}`
  )
}

async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y")
    })
  })
}

async function main() {
  printHeader()

  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`${colors.bold}Usage:${colors.reset}`)
    console.log(`  npx tsx scripts/rollback-release.ts <version> [options]`)
    console.log(`\n${colors.bold}Options:${colors.reset}`)
    console.log(`  --dry-run    Show what would happen without making changes`)
    console.log(`  --force      Skip confirmation prompt`)
    console.log(`  --help, -h   Show this help message`)
    console.log(`\n${colors.bold}Examples:${colors.reset}`)
    console.log(`  npx tsx scripts/rollback-release.ts 1.2.0`)
    console.log(`  npx tsx scripts/rollback-release.ts 1.2.0 --dry-run`)
    console.log(`  npx tsx scripts/rollback-release.ts 1.2.0 --force`)
    process.exit(0)
  }

  const version = args[0]
  const isDryRun = args.includes("--dry-run")
  const isForce = args.includes("--force")

  if (!version.match(/^\d+\.\d+\.\d+$/)) {
    console.error(
      `${colors.red}[ERROR]${colors.reset} Invalid version format: ${version}. Expected semver (e.g., 1.2.0)`
    )
    process.exit(1)
  }

  console.log(
    `${colors.blue}[i]${colors.reset} Validating rollback for version ${colors.bold}${version}${colors.reset}...`
  )
  console.log(`${colors.dim}Mode: ${isDryRun ? "DRY RUN" : "LIVE"}${colors.reset}\n`)

  try {
    // Step 1: Validate the rollback
    const validation = await validateRollback(version)
    printValidation(validation)

    if (!validation.canRollback) {
      console.log(
        `\n${colors.red}${colors.bold}[BLOCKED]${colors.reset} Rollback cannot proceed due to errors above.`
      )
      process.exit(1)
    }

    // Step 2: Dry run - show what would happen
    if (isDryRun) {
      console.log(`\n${colors.dim}---${colors.reset}`)
      console.log(`\n${colors.cyan}${colors.bold}[DRY RUN]${colors.reset} No changes were made.`)
      console.log(`\nTo perform the actual rollback, run:`)
      console.log(`  ${colors.dim}npx tsx scripts/rollback-release.ts ${version}${colors.reset}`)
      process.exit(0)
    }

    // Step 3: Confirm with user (unless --force)
    if (!isForce) {
      console.log(`\n${colors.dim}---${colors.reset}`)
      console.log(
        `\n${colors.yellow}${colors.bold}[WARNING]${colors.reset} This will rollback ${validation.targetRelease?.ruleCount || 0} rule(s) to APPROVED status.`
      )
      console.log(
        `${colors.yellow}The release record will be preserved for audit purposes.${colors.reset}`
      )

      const confirmed = await promptConfirmation(
        `\n${colors.bold}Are you sure you want to rollback version ${version}?${colors.reset}`
      )

      if (!confirmed) {
        console.log(`\n${colors.yellow}[CANCELLED]${colors.reset} Rollback aborted by user.`)
        process.exit(2)
      }
    }

    // Step 4: Perform the rollback
    console.log(`\n${colors.blue}[i]${colors.reset} Performing rollback...`)

    const result = await rollbackRelease(version, "CLI_SCRIPT", false)

    if (!result.success) {
      console.error(
        `\n${colors.red}${colors.bold}[FAILED]${colors.reset} Rollback failed: ${result.error}`
      )
      process.exit(1)
    }

    // Step 5: Report results
    console.log(`\n${colors.dim}---${colors.reset}`)
    console.log(
      `\n${colors.green}${colors.bold}[SUCCESS]${colors.reset} Rollback completed successfully!`
    )
    console.log(`\n${colors.bold}Summary:${colors.reset}`)
    console.log(`  Version rolled back: ${result.targetVersion}`)
    console.log(`  Rules reverted to APPROVED: ${result.rolledBackRuleIds.length}`)

    if (result.rolledBackRuleIds.length > 0) {
      console.log(`\n${colors.bold}Rolled back rule IDs:${colors.reset}`)
      for (const ruleId of result.rolledBackRuleIds) {
        console.log(`  - ${ruleId}`)
      }
    }

    // Fetch current state for verification
    console.log(`\n${colors.bold}Current System State:${colors.reset}`)

    const latestRelease = await prisma.ruleRelease.findFirst({
      orderBy: { releasedAt: "desc" },
      select: { version: true, releasedAt: true },
    })

    if (latestRelease) {
      console.log(`  Latest active release: ${latestRelease.version}`)
    } else {
      console.log(`  ${colors.yellow}No active releases${colors.reset}`)
    }

    const statusCounts = await prisma.regulatoryRule.groupBy({
      by: ["status"],
      _count: true,
    })

    console.log(`\n${colors.bold}Rule Status Distribution:${colors.reset}`)
    for (const { status, _count } of statusCounts) {
      console.log(`  ${status}: ${_count}`)
    }

    console.log(
      `\n${colors.dim}Audit log entries have been created for this rollback.${colors.reset}`
    )
    process.exit(0)
  } catch (error) {
    console.error(`\n${colors.red}[ERROR]${colors.reset} Unexpected error:`, error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
