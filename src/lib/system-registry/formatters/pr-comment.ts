/**
 * PR Comment Formatter
 *
 * Generates markdown for PR comments showing blast radius analysis.
 * This is the primary human-facing output of the blast radius system.
 *
 * Design goals:
 * - Clear, scannable output
 * - Actionable information (who to notify, what paths affected)
 * - Smart filtering to avoid noise (only show relevant transitive impacts)
 *
 * @example
 * ```typescript
 * import { formatPRComment } from "@/lib/system-registry/formatters/pr-comment"
 *
 * const analysis: BlastAnalysis = {
 *   directImpacts: [...],
 *   transitiveImpacts: [...],
 *   criticalPathImpacts: [...],
 *   score: { score: "HIGH", baseScore: "MEDIUM", bumps: [...] },
 *   owners: ["team:security", "team:billing"],
 *   truncated: false,
 * }
 *
 * const markdown = formatPRComment(analysis)
 * // Posts as PR comment
 * ```
 */

import type {
  DirectImpact,
  TransitiveImpact,
  CriticalPathImpact,
  BlastScore,
  Criticality,
} from "../blast-radius"

/**
 * Complete blast radius analysis result.
 * This is the input to the PR comment formatter.
 */
export interface BlastAnalysis {
  /** Components directly affected by file changes */
  directImpacts: DirectImpact[]

  /** Components transitively affected through dependency chains */
  transitiveImpacts: TransitiveImpact[]

  /** Critical paths that are impacted */
  criticalPathImpacts: CriticalPathImpact[]

  /** Computed blast score with bumps */
  score: BlastScore

  /** Canonical team slugs that own affected components (e.g., "team:security") */
  owners: string[]

  /** Whether transitive analysis was truncated due to size limits */
  truncated: boolean
}

/**
 * Icons for criticality levels.
 * Used in impact lists to visually indicate severity.
 */
const CRITICALITY_ICONS: Record<Criticality, string> = {
  CRITICAL: "\u{1F534}", // red circle
  HIGH: "\u{1F7E0}", // orange circle
  MEDIUM: "\u{1F7E1}", // yellow circle
  LOW: "\u{1F7E2}", // green circle
}

/**
 * Maps a canonical team slug to a GitHub mention.
 *
 * @param teamSlug - Canonical team slug (e.g., "team:security")
 * @returns GitHub team mention (e.g., "@fiskai/security")
 */
export function mapOwnerToMention(teamSlug: string): string {
  // Handle null/undefined/empty
  if (!teamSlug) {
    return ""
  }

  // Extract team name from "team:name" format
  if (teamSlug.startsWith("team:")) {
    const teamName = teamSlug.slice(5) // Remove "team:" prefix
    return `@fiskai/${teamName}`
  }

  // If it's already a GitHub mention, return as-is
  if (teamSlug.startsWith("@")) {
    return teamSlug
  }

  // Unknown format, return as-is
  return teamSlug
}

/**
 * Checks if a transitive impact should be displayed in the main list.
 *
 * Display filtering rules:
 * - Always show: CRITICAL or HIGH criticality
 * - Always show: Components on a critical path
 * - Always show: Components within 1 hop of direct impact
 * - Otherwise: Filter out (goes to details section)
 *
 * @param impact - The transitive impact to check
 * @param criticalPathComponentIds - Set of component IDs on critical paths
 * @returns true if the impact should be shown in the main list
 */
export function shouldShowTransitiveImpact(
  impact: TransitiveImpact,
  criticalPathComponentIds: Set<string>
): boolean {
  const criticality = impact.component.criticality as Criticality

  // Always show CRITICAL or HIGH
  if (criticality === "CRITICAL" || criticality === "HIGH") {
    return true
  }

  // Always show if on a critical path
  if (criticalPathComponentIds.has(impact.component.componentId)) {
    return true
  }

  // Always show if within 1 hop
  if (impact.distance <= 1) {
    return true
  }

  return false
}

/**
 * Extracts component IDs from critical path impacts.
 * Used to determine which transitive impacts are on critical paths.
 */
export function getCriticalPathComponentIds(
  criticalPathImpacts: CriticalPathImpact[]
): Set<string> {
  const ids = new Set<string>()
  for (const pathImpact of criticalPathImpacts) {
    for (const componentId of pathImpact.impactedComponents) {
      ids.add(componentId)
    }
  }
  return ids
}

/**
 * Formats the title section with blast score.
 */
function formatTitle(score: BlastScore): string {
  return `## \u{1F3AF} Blast Radius: ${score.score}`
}

/**
 * Formats the "You touched" section showing direct impacts.
 */
function formatDirectImpacts(directImpacts: DirectImpact[]): string {
  if (directImpacts.length === 0) {
    return ""
  }

  const componentIds = directImpacts.map((d) => `\`${d.component.componentId}\``)
  return `**You touched:** ${componentIds.join(", ")}`
}

/**
 * Formats a single transitive impact line.
 */
function formatTransitiveImpactLine(
  impact: TransitiveImpact,
  criticalPathComponentIds: Set<string>
): string {
  const icon = CRITICALITY_ICONS[impact.component.criticality as Criticality]
  const componentId = impact.component.componentId
  const criticality = impact.component.criticality

  // Build the annotation parts
  const annotations: string[] = []
  annotations.push(criticality)

  if (impact.distance === 1) {
    annotations.push("1 hop")
  } else {
    annotations.push(`${impact.distance} hops`)
  }

  if (criticalPathComponentIds.has(componentId)) {
    // Find which path(s) this component is on
    annotations.push("on critical path")
  }

  return `- ${icon} \`${componentId}\` (${annotations.join(", ")})`
}

/**
 * Formats the "This may affect" section showing filtered transitive impacts.
 */
function formatTransitiveImpacts(
  transitiveImpacts: TransitiveImpact[],
  criticalPathComponentIds: Set<string>
): string {
  if (transitiveImpacts.length === 0) {
    return ""
  }

  // Filter transitive impacts for display
  const filtered = transitiveImpacts.filter((impact) =>
    shouldShowTransitiveImpact(impact, criticalPathComponentIds)
  )

  if (filtered.length === 0) {
    return ""
  }

  const lines = filtered.map((impact) =>
    formatTransitiveImpactLine(impact, criticalPathComponentIds)
  )

  return `**This may affect:**\n${lines.join("\n")}`
}

/**
 * Formats the critical paths section.
 */
function formatCriticalPaths(criticalPathImpacts: CriticalPathImpact[]): string {
  if (criticalPathImpacts.length === 0) {
    return ""
  }

  const pathDescriptions = criticalPathImpacts.map((path) => {
    return `${path.pathName} (distance: ${path.distance})`
  })

  return `**Critical paths impacted:** ${pathDescriptions.join(", ")}`
}

/**
 * Formats the owners section.
 */
function formatOwners(owners: string[]): string {
  if (owners.length === 0) {
    return ""
  }

  const mentions = owners.map(mapOwnerToMention).filter((m) => m.length > 0)

  if (mentions.length === 0) {
    return ""
  }

  return `**Owners to notify:** ${mentions.join(", ")}`
}

/**
 * Formats the details section with full impact analysis.
 */
function formatDetails(
  directImpacts: DirectImpact[],
  transitiveImpacts: TransitiveImpact[],
  criticalPathImpacts: CriticalPathImpact[],
  score: BlastScore,
  truncated: boolean
): string {
  const sections: string[] = []

  // Direct impacts table
  if (directImpacts.length > 0) {
    const tableRows = directImpacts.map((d) => {
      const c = d.component
      return `| \`${c.componentId}\` | ${c.type} | ${c.criticality} | ${d.matchType} | ${d.matchedFiles.length} file(s) |`
    })

    sections.push(`### Direct Impacts

| Component | Type | Criticality | Match Type | Files |
|-----------|------|-------------|------------|-------|
${tableRows.join("\n")}`)
  }

  // Transitive impacts table (all of them, not just filtered)
  if (transitiveImpacts.length > 0) {
    const tableRows = transitiveImpacts.map((t) => {
      const c = t.component
      const path = t.pathThrough.map((p) => `\`${p}\``).join(" -> ")
      return `| \`${c.componentId}\` | ${c.type} | ${c.criticality} | ${t.distance} | ${path} |`
    })

    let header = `### Transitive Impacts`
    if (truncated) {
      header += ` (truncated)`
    }

    sections.push(`${header}

| Component | Type | Criticality | Distance | Path Through |
|-----------|------|-------------|----------|--------------|
${tableRows.join("\n")}`)
  }

  // Critical paths table
  if (criticalPathImpacts.length > 0) {
    const tableRows = criticalPathImpacts.map((p) => {
      const components = p.impactedComponents.map((c) => `\`${c}\``).join(", ")
      return `| ${p.pathName} | \`${p.pathId}\` | ${p.distance} | ${components} |`
    })

    sections.push(`### Critical Paths

| Path | ID | Distance | Impacted Components |
|------|-------|----------|---------------------|
${tableRows.join("\n")}`)
  }

  // Score breakdown
  if (score.bumps.length > 0) {
    const bumpRows = score.bumps.map((b) => {
      return `| ${b.from} -> ${b.to} | ${b.reason} |`
    })

    sections.push(`### Score Breakdown

Base score: **${score.baseScore}** | Final score: **${score.score}**

| Bump | Reason |
|------|--------|
${bumpRows.join("\n")}`)
  }

  if (sections.length === 0) {
    return ""
  }

  return `<details>
<summary>Full impact analysis</summary>

${sections.join("\n\n")}

</details>`
}

/**
 * Generates markdown for a PR comment showing blast radius analysis.
 *
 * The output format is designed to be:
 * - Scannable: Key information visible at a glance
 * - Actionable: Clear who needs to review
 * - Expandable: Full details available in collapsed section
 *
 * @param analysis - The blast radius analysis result
 * @returns Markdown string for PR comment
 */
export function formatPRComment(analysis: BlastAnalysis): string {
  const { directImpacts, transitiveImpacts, criticalPathImpacts, score, owners, truncated } =
    analysis

  // Get critical path component IDs for filtering
  const criticalPathComponentIds = getCriticalPathComponentIds(criticalPathImpacts)

  // Build sections
  const sections: string[] = []

  // Always include title
  sections.push(formatTitle(score))

  // Add non-empty sections
  const touched = formatDirectImpacts(directImpacts)
  if (touched) {
    sections.push(touched)
  }

  const mayAffect = formatTransitiveImpacts(transitiveImpacts, criticalPathComponentIds)
  if (mayAffect) {
    sections.push(mayAffect)
  }

  const paths = formatCriticalPaths(criticalPathImpacts)
  if (paths) {
    sections.push(paths)
  }

  const ownersSection = formatOwners(owners)
  if (ownersSection) {
    sections.push(ownersSection)
  }

  // Add details section if we have any impacts
  const details = formatDetails(
    directImpacts,
    transitiveImpacts,
    criticalPathImpacts,
    score,
    truncated
  )
  if (details) {
    sections.push(details)
  }

  return sections.join("\n\n")
}
