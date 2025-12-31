// src/lib/regulatory-truth/content-sync/repo-adapter.ts
/**
 * Content repository adapter for git operations.
 *
 * This module provides an abstraction for interacting with the content repository
 * to create branches, commit changes, push, and create pull requests.
 */

import { execSync } from "child_process"

import type { ChangeType } from "./types"
import { RepoWriteFailedError } from "./errors"

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for creating a pull request.
 */
export interface CreatePRParams {
  /** PR title */
  title: string
  /** PR body (markdown) */
  body: string
  /** Base branch to merge into (defaults to "main") */
  base?: string
}

/**
 * Interface for content repository operations.
 */
export interface ContentRepoAdapter {
  /** Create or checkout a git branch (idempotent for retries) */
  createBranch(branchName: string): void
  /** Stage files for commit */
  stageFiles(files: string[]): void
  /** Create a commit with the staged changes */
  commit(message: string): void
  /** Push a branch to the remote repository */
  pushBranch(branchName: string): void
  /** Create a pull request and return the PR URL */
  createPR(params: CreatePRParams): string
  /** Get the name of the current branch */
  getCurrentBranch(): string
  /** Check if a local branch exists */
  branchExists(branchName: string): boolean
  /** Reset working tree to clean state (discard uncommitted changes) */
  resetWorkingTree(): void
  /** Return to main branch and optionally delete a feature branch */
  cleanup(branchName?: string): void
}

// =============================================================================
// Git Implementation
// =============================================================================

/**
 * Git-based implementation of ContentRepoAdapter.
 *
 * Uses execSync to run git and gh CLI commands.
 * All operations are scoped to the provided repoRoot directory.
 */
export class GitContentRepoAdapter implements ContentRepoAdapter {
  constructor(private readonly repoRoot: string) {}

  /**
   * Execute a git command in the repo root.
   * Wraps errors in RepoWriteFailedError.
   */
  private exec(command: string, operation: string): string {
    try {
      return execSync(command, {
        cwd: this.repoRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim()
    } catch (err) {
      throw new RepoWriteFailedError(operation, err instanceof Error ? err : new Error(String(err)))
    }
  }

  /**
   * Create a new branch or checkout existing one (idempotent for retries).
   * If the branch already exists (e.g., from a previous failed attempt),
   * checks it out instead of failing.
   */
  createBranch(branchName: string): void {
    if (this.branchExists(branchName)) {
      // Branch exists from prior attempt - reset and checkout
      this.resetWorkingTree()
      this.exec(`git checkout "${branchName}"`, `checkoutBranch(${branchName})`)
    } else {
      this.exec(`git checkout -b "${branchName}"`, `createBranch(${branchName})`)
    }
  }

  branchExists(branchName: string): boolean {
    try {
      // git rev-parse exits 0 if ref exists, non-zero otherwise
      execSync(`git rev-parse --verify "refs/heads/${branchName}"`, {
        cwd: this.repoRoot,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      })
      return true
    } catch {
      return false
    }
  }

  resetWorkingTree(): void {
    // Discard all uncommitted changes
    this.exec("git checkout -- .", "resetWorkingTree")
    this.exec("git clean -fd", "cleanUntracked")
  }

  cleanup(branchName?: string): void {
    // First reset any uncommitted changes
    this.resetWorkingTree()
    // Return to main
    this.exec("git checkout main", "checkoutMain")
    // Delete the feature branch if specified
    if (branchName) {
      try {
        this.exec(`git branch -D "${branchName}"`, `deleteBranch(${branchName})`)
      } catch {
        // Branch may not exist, ignore
      }
    }
  }

  stageFiles(files: string[]): void {
    if (files.length === 0) {
      return
    }
    // Quote each file path to handle spaces
    const quotedFiles = files.map((f) => `"${f}"`).join(" ")
    this.exec(`git add ${quotedFiles}`, "stageFiles")
  }

  commit(message: string): void {
    // Use heredoc-style message to handle multi-line commit messages
    this.exec(`git commit -m "${message.replace(/"/g, '\\"')}"`, "commit")
  }

  pushBranch(branchName: string): void {
    this.exec(`git push -u origin "${branchName}"`, `pushBranch(${branchName})`)
  }

  createPR(params: CreatePRParams): string {
    const base = params.base ?? "main"
    const escapedTitle = params.title.replace(/"/g, '\\"')
    const escapedBody = params.body.replace(/"/g, '\\"')

    const result = this.exec(
      `gh pr create --base "${base}" --title "${escapedTitle}" --body "${escapedBody}"`,
      "createPR"
    )

    // gh pr create returns the PR URL
    return result
  }

  getCurrentBranch(): string {
    return this.exec("git rev-parse --abbrev-ref HEAD", "getCurrentBranch")
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a branch name for a content sync operation.
 *
 * Format: `content-sync/YYYY-MM-DD-{conceptId}-{shortId}`
 *
 * @param eventId - The event ID (first 8 chars used as shortId)
 * @param conceptId - The concept ID
 * @returns The generated branch name
 *
 * @example
 * generateBranchName("evt_abc12345xyz", "pdv-threshold")
 * // => "content-sync/2025-01-15-pdv-threshold-evt_abc1"
 */
export function generateBranchName(eventId: string, conceptId: string): string {
  const today = new Date().toISOString().split("T")[0]
  const shortId = eventId.slice(0, 8)
  return `content-sync/${today}-${conceptId}-${shortId}`
}

/**
 * Generate a PR title for a content sync operation.
 *
 * @param conceptId - The concept ID
 * @param changeType - The type of change (create, update, repeal)
 * @returns The generated PR title
 *
 * @example
 * generatePRTitle("pdv-threshold", "update")
 * // => "docs: Update pdv-threshold content from RTL"
 */
export function generatePRTitle(conceptId: string, changeType: ChangeType): string {
  const action = changeType === "create" ? "Add" : changeType === "update" ? "Update" : "Remove"

  return `docs: ${action} ${conceptId} content from RTL`
}

/**
 * Parameters for generating a PR body.
 */
export interface GeneratePRBodyParams {
  /** Event ID for traceability */
  eventId: string
  /** Concept ID being updated */
  conceptId: string
  /** Regulatory rule ID */
  ruleId: string
  /** Type of change */
  changeType: ChangeType
  /** Effective date of the change */
  effectiveFrom: string
  /** IDs of source pointers for evidence trail */
  sourcePointerIds: string[]
  /** Primary authoritative source URL (optional) */
  primarySourceUrl?: string
  /** List of files being patched */
  patchedFiles: string[]
}

/**
 * Generate a PR body for a content sync operation.
 *
 * The body includes:
 * - Event metadata (ID, concept, rule, change type, effective date)
 * - Source pointer IDs for audit trail
 * - Primary source URL if available
 * - List of patched files
 * - Note requiring human review
 *
 * @param params - The parameters for generating the PR body
 * @returns The generated markdown PR body
 */
export function generatePRBody(params: GeneratePRBodyParams): string {
  const {
    eventId,
    conceptId,
    ruleId,
    changeType,
    effectiveFrom,
    sourcePointerIds,
    primarySourceUrl,
    patchedFiles,
  } = params

  const lines: string[] = [
    "## RTL Content Sync",
    "",
    "This PR was automatically generated by the Regulatory Truth Layer content sync pipeline.",
    "",
    "### Event Details",
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| Event ID | \`${eventId}\` |`,
    `| Concept | \`${conceptId}\` |`,
    `| Rule ID | \`${ruleId}\` |`,
    `| Change Type | ${changeType} |`,
    `| Effective From | ${effectiveFrom} |`,
    "",
  ]

  // Source pointers section
  lines.push("### Source Pointers")
  lines.push("")
  lines.push("Evidence trail for this change:")
  lines.push("")
  for (const pointerId of sourcePointerIds) {
    lines.push(`- \`${pointerId}\``)
  }
  lines.push("")

  // Primary source URL if available
  if (primarySourceUrl) {
    lines.push("### Primary Source")
    lines.push("")
    lines.push(`[${primarySourceUrl}](${primarySourceUrl})`)
    lines.push("")
  }

  // Patched files section
  lines.push("### Patched Files")
  lines.push("")
  for (const file of patchedFiles) {
    lines.push(`- \`${file}\``)
  }
  lines.push("")

  // Human review note
  lines.push("---")
  lines.push("")
  lines.push(
    "> **Note:** This PR requires human review before merging. " +
      "Please verify that the content changes accurately reflect the regulatory update."
  )
  lines.push("")

  return lines.join("\n")
}
