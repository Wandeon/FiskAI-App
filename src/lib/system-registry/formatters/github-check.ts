/**
 * GitHub Check Reporter
 *
 * Generates GitHub Check API payload for blast radius enforcement.
 * This is the machine-readable enforcement mechanism that determines
 * whether a PR can be merged.
 *
 * While the PR comment (pr-comment.ts) is human-facing, this check
 * determines the actual merge gate behavior.
 *
 * Status mapping:
 * - LOW/MEDIUM -> success (always pass)
 * - HIGH -> neutral (informational, does not block)
 * - CRITICAL -> neutral (warn mode) or failure (fail mode)
 *
 * @see https://docs.github.com/en/rest/checks/runs
 *
 * @example
 * ```typescript
 * import { formatGitHubCheck } from "@/lib/system-registry/formatters/github-check"
 *
 * const analysis: BlastAnalysis = {
 *   directImpacts: [...],
 *   transitiveImpacts: [...],
 *   criticalPathImpacts: [...],
 *   score: { score: "CRITICAL", baseScore: "HIGH", bumps: [...] },
 *   owners: ["team:security"],
 *   truncated: false,
 * }
 *
 * // Warn mode: CRITICAL produces neutral (does not block)
 * const checkWarn = formatGitHubCheck(analysis, "warn")
 *
 * // Fail mode: CRITICAL produces failure (blocks merge)
 * const checkFail = formatGitHubCheck(analysis, "fail")
 * ```
 */

import type { BlastAnalysis } from "./pr-comment"
import type { Criticality, BlastScore } from "../blast-radius"

/**
 * GitHub Check API output structure.
 * Maps to the GitHub Check Run API payload.
 *
 * @see https://docs.github.com/en/rest/checks/runs#create-a-check-run
 */
export interface CheckOutput {
  /** Check run name (e.g., "registry/blast-radius") */
  name: string

  /**
   * Check status.
   * For blast radius, we always report as if completed.
   * Using the conclusion field to indicate result.
   */
  status: "success" | "neutral" | "failure"

  /**
   * Check conclusion.
   * - success: LOW/MEDIUM score
   * - neutral: HIGH score, or CRITICAL in warn mode
   * - failure: CRITICAL score in fail mode
   */
  conclusion: "success" | "neutral" | "failure"

  /** Summary line shown in check UI */
  title: string

  /** Markdown summary (short form) */
  summary: string

  /** Detailed markdown (can include full analysis) */
  text: string

  /**
   * Optional file annotations for inline comments.
   * Not implemented in v1 - requires file/line parsing.
   */
  annotations?: Array<{
    path: string
    start_line: number
    end_line: number
    annotation_level: "warning" | "failure"
    message: string
  }>
}

/**
 * Enforcement mode for the check.
 * - warn: CRITICAL scores produce neutral (informational)
 * - fail: CRITICAL scores produce failure (blocks merge)
 */
export type EnforcementMode = "warn" | "fail"

/**
 * The check name used in GitHub.
 * This is the identifier that appears in the PR checks list.
 */
export const CHECK_NAME = "registry/blast-radius"

/**
 * Maps a blast score to a check status/conclusion.
 *
 * Status mapping:
 * - LOW/MEDIUM -> success
 * - HIGH -> neutral
 * - CRITICAL -> neutral (warn mode) or failure (fail mode)
 */
function mapScoreToStatus(
  score: Criticality,
  enforcementMode: EnforcementMode
): "success" | "neutral" | "failure" {
  switch (score) {
    case "LOW":
    case "MEDIUM":
      return "success"

    case "HIGH":
      return "neutral"

    case "CRITICAL":
      return enforcementMode === "fail" ? "failure" : "neutral"

    default:
      // Defensive: treat unknown as success
      return "success"
  }
}

/**
 * Generates the title line for the check.
 * Shows the score and a brief description.
 */
function generateTitle(score: BlastScore): string {
  const descriptions: Record<Criticality, string> = {
    LOW: "Low impact change",
    MEDIUM: "Moderate impact change",
    HIGH: "High impact change - review recommended",
    CRITICAL: "Critical impact - requires attention",
  }

  return `Blast Radius: ${score.score} - ${descriptions[score.score]}`
}

/**
 * Generates the summary section for the check.
 * Short markdown shown in the check overview.
 */
function generateSummary(analysis: BlastAnalysis): string {
  const { directImpacts, transitiveImpacts, criticalPathImpacts, score, owners } = analysis

  const lines: string[] = []

  // Score summary
  lines.push(`**Score:** ${score.score}`)

  if (score.bumps.length > 0) {
    lines.push(`(bumped from ${score.baseScore})`)
  }

  lines.push("")

  // Quick stats
  const stats: string[] = []

  if (directImpacts.length > 0) {
    stats.push(`${directImpacts.length} direct impact(s)`)
  }

  if (transitiveImpacts.length > 0) {
    stats.push(`${transitiveImpacts.length} transitive impact(s)`)
  }

  if (criticalPathImpacts.length > 0) {
    stats.push(`${criticalPathImpacts.length} critical path(s) affected`)
  }

  if (stats.length > 0) {
    lines.push(stats.join(" | "))
  }

  // Owners
  if (owners.length > 0) {
    lines.push("")
    lines.push(`**Notify:** ${owners.join(", ")}`)
  }

  return lines.join("\n")
}

/**
 * Generates the detailed text section for the check.
 * Full markdown analysis, similar to PR comment content.
 */
function generateText(analysis: BlastAnalysis): string {
  const { directImpacts, transitiveImpacts, criticalPathImpacts, score, truncated } = analysis

  const sections: string[] = []

  // Direct impacts
  if (directImpacts.length > 0) {
    const componentList = directImpacts
      .map((d) => `- \`${d.component.componentId}\` (${d.component.criticality})`)
      .join("\n")

    sections.push(`### Direct Impacts\n\n${componentList}`)
  }

  // Transitive impacts (top-level summary only)
  if (transitiveImpacts.length > 0) {
    const highPriority = transitiveImpacts.filter(
      (t) => t.component.criticality === "CRITICAL" || t.component.criticality === "HIGH"
    )

    if (highPriority.length > 0) {
      const componentList = highPriority
        .map(
          (t) =>
            `- \`${t.component.componentId}\` (${t.component.criticality}, ${t.distance} hop${t.distance === 1 ? "" : "s"})`
        )
        .join("\n")

      let header = `### High-Priority Transitive Impacts`
      if (truncated) {
        header += " (analysis truncated)"
      }

      sections.push(`${header}\n\n${componentList}`)
    }

    // Summary of remaining
    const remaining = transitiveImpacts.length - highPriority.length
    if (remaining > 0) {
      sections.push(`*+${remaining} additional transitive impact(s) of lower priority*`)
    }
  }

  // Critical paths
  if (criticalPathImpacts.length > 0) {
    const pathList = criticalPathImpacts
      .map((p) => `- **${p.pathName}** (distance: ${p.distance})`)
      .join("\n")

    sections.push(`### Critical Paths Impacted\n\n${pathList}`)
  }

  // Score breakdown
  if (score.bumps.length > 0) {
    const bumpList = score.bumps.map((b) => `- ${b.from} -> ${b.to}: ${b.reason}`).join("\n")

    sections.push(
      `### Score Breakdown\n\nBase: **${score.baseScore}** | Final: **${score.score}**\n\n${bumpList}`
    )
  }

  if (sections.length === 0) {
    return "No significant impacts detected."
  }

  return sections.join("\n\n")
}

/**
 * Generates a GitHub Check API payload for blast radius analysis.
 *
 * The output can be used directly with the GitHub Checks API to
 * create or update a check run.
 *
 * @param analysis - The blast radius analysis result
 * @param enforcementMode - How to handle CRITICAL scores ("warn" or "fail")
 * @returns CheckOutput ready for GitHub API
 */
export function formatGitHubCheck(
  analysis: BlastAnalysis,
  enforcementMode: EnforcementMode
): CheckOutput {
  const status = mapScoreToStatus(analysis.score.score, enforcementMode)

  return {
    name: CHECK_NAME,
    status,
    conclusion: status,
    title: generateTitle(analysis.score),
    summary: generateSummary(analysis),
    text: generateText(analysis),
    // annotations omitted in v1 - would require file/line parsing
  }
}
