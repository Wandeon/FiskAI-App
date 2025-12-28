/**
 * Compute Drift
 *
 * Compares observed components (from harvesters) against declared components (from registry).
 * Produces drift entries for:
 * - OBSERVED_NOT_DECLARED: Component exists in code but not in registry
 * - DECLARED_NOT_OBSERVED: Component is in registry but not found in code
 * - METADATA_GAP: Component is declared but missing required metadata
 * - CODEREF_INVALID: Declared codeRef path does not exist on disk
 *
 * This is the core of CI enforcement.
 */

import { existsSync, readdirSync } from "fs"
import { join } from "path"
import type {
  DriftEntry,
  SystemComponent,
  ObservedComponent,
  EnforcementRule,
  ComponentType,
  ComponentCriticality,
} from "./schema"
import {
  COMPONENT_TYPES,
  DEFAULT_ENFORCEMENT_RULES,
  CRITICAL_ROUTE_GROUPS,
  CRITICAL_JOBS,
  CRITICAL_QUEUES,
} from "./schema"
import {
  isIgnoredComponent,
  CODEREF_REQUIRED_TYPES,
  CODEREF_REQUIRED_CRITICALITIES,
  validateOwner,
  validateGovernance,
  type GovernanceViolation,
} from "./governance"

/**
 * All component types are now harvested.
 */
export const HARVESTED_TYPES: ComponentType[] = [
  "ROUTE_GROUP",
  "JOB",
  "WORKER",
  "QUEUE",
  "MODULE",
  "LIB",
  "STORE",
  "INTEGRATION",
  "UI",
]

export interface TypeCoverage {
  type: ComponentType
  harvested: boolean
  declared: number
  observed: number
  codeRefVerified: number
  codeRefMissing: number
}

export interface DeprecatedOwnerEntry {
  componentId: string
  owner: string
  migratesTo: string
  reason: string
}

export interface DriftResult {
  observedNotDeclared: DriftEntry[]
  declaredNotObserved: DriftEntry[]
  metadataGaps: DriftEntry[]
  codeRefInvalid: DriftEntry[]
  /** Unknown integrations that need triage */
  unknownIntegrations: DriftEntry[]
  /** Governance validation violations */
  governanceViolations: GovernanceViolation[]
  /** Components using deprecated owner slugs */
  deprecatedOwners: DeprecatedOwnerEntry[]
  summary: {
    /** Total components found by harvesters */
    observedTotal: number
    /** Total declared components in registry */
    declaredTotal: number
    observedNotDeclaredCount: number
    declaredNotObservedCount: number
    metadataGapCount: number
    /** Declared components with invalid/missing codeRef paths */
    codeRefInvalidCount: number
    /** Unknown integrations requiring triage */
    unknownIntegrationCount: number
    criticalIssues: number
    highIssues: number
  }
  /** Type-by-type coverage matrix */
  typeCoverage: TypeCoverage[]
}

export interface EnforcementResult {
  passed: boolean
  failures: EnforcementFailure[]
  warnings: EnforcementFailure[]
}

export interface EnforcementFailure {
  componentId: string
  type: ComponentType
  rule: string
  message: string
}

/**
 * Infers criticality based on component ID and known critical lists.
 */
function inferCriticality(
  componentId: string,
  type: ComponentType
): ComponentCriticality {
  // Check against known critical lists
  if (CRITICAL_ROUTE_GROUPS.includes(componentId)) return "CRITICAL"
  if (CRITICAL_JOBS.includes(componentId)) return "CRITICAL"
  if (CRITICAL_QUEUES.includes(componentId)) return "CRITICAL"

  // Default criticality by type
  switch (type) {
    case "ROUTE_GROUP":
      if (
        componentId.includes("auth") ||
        componentId.includes("billing") ||
        componentId.includes("fiscal") ||
        componentId.includes("invoice")
      ) {
        return "HIGH"
      }
      return "MEDIUM"
    case "JOB":
      return "MEDIUM"
    case "QUEUE":
      return "MEDIUM"
    case "WORKER":
      return "HIGH"
    case "INTEGRATION":
      return "HIGH"
    case "STORE":
      return "CRITICAL"
    case "MODULE":
      return "MEDIUM"
    case "LIB":
      return "MEDIUM"
    case "UI":
      return "MEDIUM"
    default:
      return "LOW"
  }
}

/**
 * Verifies that a codeRef path exists on disk.
 * For directories, also checks that they're non-empty.
 */
function verifyCodeRef(projectRoot: string, codeRef: string): boolean {
  const fullPath = join(projectRoot, codeRef)

  if (!existsSync(fullPath)) {
    return false
  }

  // For directories, check they're not empty
  try {
    const entries = readdirSync(fullPath)
    // Filter out hidden files and common non-code files
    const codeFiles = entries.filter(
      (e) => !e.startsWith(".") && e !== "node_modules"
    )
    return codeFiles.length > 0
  } catch {
    // If it's a file (not a directory), it exists and that's enough
    return true
  }
}

/**
 * Computes drift between observed and declared components.
 */
export function computeDrift(
  observed: ObservedComponent[],
  declared: SystemComponent[],
  projectRoot: string = process.cwd()
): DriftResult {
  const observedIds = new Set(observed.map((c) => c.componentId))
  const declaredIds = new Set(declared.map((c) => c.componentId))
  const declaredMap = new Map(declared.map((c) => [c.componentId, c]))

  // Build alias resolution map
  const aliasMap = new Map<string, string>()
  for (const d of declared) {
    if (d.aliases) {
      for (const alias of d.aliases) {
        aliasMap.set(alias, d.componentId)
      }
    }
  }

  const observedNotDeclared: DriftEntry[] = []
  const declaredNotObserved: DriftEntry[] = []
  const metadataGaps: DriftEntry[] = []
  const codeRefInvalid: DriftEntry[] = []
  const unknownIntegrations: DriftEntry[] = []
  const deprecatedOwners: DeprecatedOwnerEntry[] = []

  // Validate governance integrity
  const governanceViolations = validateGovernance()

  // Track type coverage
  const typeStats = new Map<
    ComponentType,
    { declared: number; observed: number; codeRefVerified: number; codeRefMissing: number }
  >()
  for (const type of COMPONENT_TYPES) {
    typeStats.set(type, { declared: 0, observed: 0, codeRefVerified: 0, codeRefMissing: 0 })
  }

  // Count observed by type
  for (const obs of observed) {
    const stats = typeStats.get(obs.type)!
    stats.observed++
  }

  // Count declared by type and verify codeRefs for ALL declared components
  for (const decl of declared) {
    const stats = typeStats.get(decl.type)!
    stats.declared++

    // Skip ignored components
    if (isIgnoredComponent(decl.componentId)) {
      continue
    }

    // Check for deprecated owners
    if (decl.owner) {
      const ownerValidation = validateOwner(decl.owner)
      if (ownerValidation.deprecated) {
        deprecatedOwners.push({
          componentId: decl.componentId,
          owner: decl.owner,
          migratesTo: ownerValidation.migratesTo!,
          reason: ownerValidation.reason!,
        })
      }
    }

    // Validate internal flag usage (only valid for LIB)
    if (decl.internal !== undefined && decl.type !== "LIB") {
      metadataGaps.push({
        componentId: decl.componentId,
        type: decl.type,
        driftType: "METADATA_GAP",
        risk: decl.criticality,
        reason: `internal flag is only valid for LIB type, found on ${decl.type}`,
        gaps: [],
      })
    }

    // Verify codeRef for all declared components that have one
    if (decl.codeRef) {
      const exists = verifyCodeRef(projectRoot, decl.codeRef)
      if (exists) {
        stats.codeRefVerified++
      } else {
        stats.codeRefMissing++

        // Check if this criticality requires enforcement
        const enforcement = CODEREF_REQUIRED_CRITICALITIES[decl.criticality]
        if (enforcement) {
          codeRefInvalid.push({
            componentId: decl.componentId,
            type: decl.type,
            driftType: "CODEREF_INVALID",
            risk: decl.criticality,
            declaredSource: decl.codeRef,
            reason: `codeRef path does not exist: ${decl.codeRef}`,
          })
        }
      }
    } else {
      // No codeRef provided - check if one is required
      if (
        CODEREF_REQUIRED_TYPES.includes(decl.type) &&
        (decl.criticality === "CRITICAL" || decl.criticality === "HIGH")
      ) {
        stats.codeRefMissing++
        codeRefInvalid.push({
          componentId: decl.componentId,
          type: decl.type,
          driftType: "CODEREF_INVALID",
          risk: decl.criticality,
          declaredSource: undefined,
          reason: "codeRef is required for CRITICAL/HIGH components but not provided",
        })
      }
    }

    // Validate codeRefs[] if provided
    if (decl.codeRefs !== undefined) {
      // Empty array is invalid - if you declare codeRefs, it must contain paths
      if (decl.codeRefs.length === 0) {
        codeRefInvalid.push({
          componentId: decl.componentId,
          type: decl.type,
          driftType: "CODEREF_INVALID",
          risk: decl.criticality,
          declaredSource: "codeRefs[]",
          reason: "codeRefs[] is declared but empty - remove or add paths",
        })
      } else {
        // Verify each path in codeRefs exists
        for (const ref of decl.codeRefs) {
          const exists = verifyCodeRef(projectRoot, ref)
          if (!exists) {
            const enforcement = CODEREF_REQUIRED_CRITICALITIES[decl.criticality]
            if (enforcement) {
              codeRefInvalid.push({
                componentId: decl.componentId,
                type: decl.type,
                driftType: "CODEREF_INVALID",
                risk: decl.criticality,
                declaredSource: ref,
                reason: `codeRefs[] path does not exist: ${ref}`,
              })
            }
          }
        }
      }
    }
  }

  // Find observed but not declared
  for (const obs of observed) {
    const resolvedId = aliasMap.get(obs.componentId) || obs.componentId
    if (!declaredIds.has(resolvedId)) {
      const criticality = inferCriticality(obs.componentId, obs.type)

      // Check if this is an unknown integration
      const isUnknownIntegration =
        obs.type === "INTEGRATION" &&
        obs.metadata?.isUnknown === true

      if (isUnknownIntegration) {
        // Unknown integrations get their own list with HIGH risk
        unknownIntegrations.push({
          componentId: obs.componentId,
          type: obs.type,
          driftType: "OBSERVED_NOT_DECLARED",
          risk: "HIGH", // Unknown external services are HIGH risk
          observedAt: obs.observedAt,
          reason: "Unknown integration detected - requires declaration or explicit ignore decision",
        })
      } else {
        observedNotDeclared.push({
          componentId: obs.componentId,
          type: obs.type,
          driftType: "OBSERVED_NOT_DECLARED",
          risk: criticality,
          observedAt: obs.observedAt,
        })
      }
    }
  }

  // Find declared but not observed (only for harvested types)
  for (const decl of declared) {
    // Only check harvested types for "not observed"
    if (!HARVESTED_TYPES.includes(decl.type)) continue

    let found = observedIds.has(decl.componentId)
    if (!found && decl.aliases) {
      found = decl.aliases.some((a) => observedIds.has(a))
    }

    if (!found) {
      declaredNotObserved.push({
        componentId: decl.componentId,
        type: decl.type,
        driftType: "DECLARED_NOT_OBSERVED",
        risk: decl.criticality,
        declaredSource: decl.codeRef || undefined,
      })
    }
  }

  // Find metadata gaps in declared components
  for (const decl of declared) {
    const gaps: DriftEntry["gaps"] = []

    const ownerValidation = decl.owner ? validateOwner(decl.owner) : null
    const ownerMissing = !decl.owner || (ownerValidation && !ownerValidation.valid)
    if (ownerMissing) {
      if (decl.criticality === "CRITICAL" || decl.criticality === "HIGH") {
        gaps.push("NO_OWNER")
      }
    }

    if (!decl.docsRef) {
      // Internal libs have relaxed docsRef requirements
      const isInternalLib = decl.type === "LIB" && decl.internal === true
      if (decl.criticality === "CRITICAL" && !isInternalLib) {
        gaps.push("NO_DOCS")
      }
    }

    if (!decl.codeRef) {
      if (decl.criticality === "CRITICAL" || decl.criticality === "HIGH") {
        gaps.push("NO_CODE_REF")
      }
    }

    if (decl.dependencies.length === 0) {
      if (decl.type !== "STORE" && decl.type !== "UI") {
        gaps.push("NO_DEPENDENCIES")
      }
    }

    if (gaps.length > 0) {
      metadataGaps.push({
        componentId: decl.componentId,
        type: decl.type,
        driftType: "METADATA_GAP",
        risk: decl.criticality,
        gaps,
      })
    }
  }

  // Sort all arrays for deterministic output
  const sortByComponentId = (a: DriftEntry, b: DriftEntry) =>
    a.componentId.localeCompare(b.componentId)
  observedNotDeclared.sort(sortByComponentId)
  declaredNotObserved.sort(sortByComponentId)
  metadataGaps.sort(sortByComponentId)
  codeRefInvalid.sort(sortByComponentId)
  unknownIntegrations.sort(sortByComponentId)
  deprecatedOwners.sort((a, b) => a.componentId.localeCompare(b.componentId))

  // Build type coverage matrix
  const typeCoverage: TypeCoverage[] = COMPONENT_TYPES.map((type) => {
    const stats = typeStats.get(type)!
    return {
      type,
      harvested: HARVESTED_TYPES.includes(type),
      declared: stats.declared,
      observed: stats.observed,
      codeRefVerified: stats.codeRefVerified,
      codeRefMissing: stats.codeRefMissing,
    }
  }).sort((a, b) => a.type.localeCompare(b.type))

  // Calculate summary
  const criticalIssues =
    observedNotDeclared.filter((d) => d.risk === "CRITICAL").length +
    declaredNotObserved.filter((d) => d.risk === "CRITICAL").length +
    metadataGaps.filter((d) => d.risk === "CRITICAL").length +
    codeRefInvalid.filter((d) => d.risk === "CRITICAL").length +
    unknownIntegrations.filter((d) => d.risk === "CRITICAL").length

  const highIssues =
    observedNotDeclared.filter((d) => d.risk === "HIGH").length +
    declaredNotObserved.filter((d) => d.risk === "HIGH").length +
    metadataGaps.filter((d) => d.risk === "HIGH").length +
    codeRefInvalid.filter((d) => d.risk === "HIGH").length +
    unknownIntegrations.filter((d) => d.risk === "HIGH").length

  return {
    observedNotDeclared,
    declaredNotObserved,
    metadataGaps,
    codeRefInvalid,
    unknownIntegrations,
    governanceViolations,
    deprecatedOwners,
    summary: {
      observedTotal: observed.length,
      declaredTotal: declared.length,
      observedNotDeclaredCount: observedNotDeclared.length,
      declaredNotObservedCount: declaredNotObserved.length,
      metadataGapCount: metadataGaps.length,
      codeRefInvalidCount: codeRefInvalid.length,
      unknownIntegrationCount: unknownIntegrations.length,
      criticalIssues,
      highIssues,
    },
    typeCoverage,
  }
}

/**
 * Enforces rules against drift results.
 * Returns pass/fail status for CI gates.
 */
export function enforceRules(
  driftResult: DriftResult,
  rules: EnforcementRule[] = DEFAULT_ENFORCEMENT_RULES
): EnforcementResult {
  const failures: EnforcementFailure[] = []
  const warnings: EnforcementFailure[] = []

  // Check governance violations (always FAIL)
  for (const violation of driftResult.governanceViolations) {
    failures.push({
      componentId: violation.name,
      type: "LIB", // Governance violations are typically about exclusions
      rule: "Governance integrity",
      message: `Governance violation in ${violation.type}: ${violation.issue}`,
    })
  }

  // Check OBSERVED_NOT_DECLARED against MUST_BE_DECLARED rules
  for (const drift of driftResult.observedNotDeclared) {
    for (const rule of rules) {
      if (rule.check !== "MUST_BE_DECLARED") continue
      if (!rule.types.includes(drift.type)) continue
      if (!rule.criticalities.includes(drift.risk)) continue

      const failure: EnforcementFailure = {
        componentId: drift.componentId,
        type: drift.type,
        rule: rule.description,
        message: `Component ${drift.componentId} must be declared in registry (${rule.description})`,
      }

      if (rule.action === "FAIL") {
        failures.push(failure)
      } else {
        warnings.push(failure)
      }
    }
  }

  // Unknown integrations always WARN (prevents silent external service additions)
  for (const drift of driftResult.unknownIntegrations) {
    warnings.push({
      componentId: drift.componentId,
      type: drift.type,
      rule: "Unknown integration detection",
      message: `Unknown integration detected: ${drift.componentId} - requires declaration or explicit ignore`,
    })
  }

  // Check DECLARED_NOT_OBSERVED for CRITICAL/HIGH (paper registry prevention)
  for (const drift of driftResult.declaredNotObserved) {
    if (drift.risk === "CRITICAL") {
      failures.push({
        componentId: drift.componentId,
        type: drift.type,
        rule: "CRITICAL components must exist in codebase",
        message: `Component ${drift.componentId} is declared but not observed - possible paper registry entry or detection gap`,
      })
    } else if (drift.risk === "HIGH") {
      warnings.push({
        componentId: drift.componentId,
        type: drift.type,
        rule: "HIGH components should exist in codebase",
        message: `Component ${drift.componentId} is declared but not observed - verify it exists or remove declaration`,
      })
    }
  }

  // Check codeRef invalid for CRITICAL/HIGH components using governance rules
  for (const drift of driftResult.codeRefInvalid) {
    const enforcement = CODEREF_REQUIRED_CRITICALITIES[drift.risk]
    if (enforcement === "FAIL") {
      failures.push({
        componentId: drift.componentId,
        type: drift.type,
        rule: "CRITICAL components must have valid codeRef",
        message: `Component ${drift.componentId} has invalid/missing codeRef: ${drift.declaredSource || "(not provided)"}`,
      })
    } else if (enforcement === "WARN") {
      warnings.push({
        componentId: drift.componentId,
        type: drift.type,
        rule: "HIGH components should have valid codeRef",
        message: `Component ${drift.componentId} has invalid/missing codeRef: ${drift.declaredSource || "(not provided)"}`,
      })
    }
  }

  // Check deprecated owners (WARN to allow migration period)
  for (const entry of driftResult.deprecatedOwners) {
    warnings.push({
      componentId: entry.componentId,
      type: "MODULE", // Owner deprecation applies across types
      rule: "Owner migration required",
      message: `Component ${entry.componentId} uses deprecated owner "${entry.owner}" - migrate to "${entry.migratesTo}" (${entry.reason})`,
    })
  }

  // Check metadata gaps against MUST_HAVE_OWNER and MUST_HAVE_DOCS rules
  for (const drift of driftResult.metadataGaps) {
    if (!drift.gaps) continue

    for (const rule of rules) {
      if (!rule.types.includes(drift.type)) continue
      if (!rule.criticalities.includes(drift.risk)) continue

      if (rule.check === "MUST_HAVE_OWNER" && drift.gaps.includes("NO_OWNER")) {
        const failure: EnforcementFailure = {
          componentId: drift.componentId,
          type: drift.type,
          rule: rule.description,
          message: `Component ${drift.componentId} must have an owner (${rule.description})`,
        }

        if (rule.action === "FAIL") {
          failures.push(failure)
        } else {
          warnings.push(failure)
        }
      }

      if (rule.check === "MUST_HAVE_DOCS" && drift.gaps.includes("NO_DOCS")) {
        const failure: EnforcementFailure = {
          componentId: drift.componentId,
          type: drift.type,
          rule: rule.description,
          message: `Component ${drift.componentId} must have documentation (${rule.description})`,
        }

        if (rule.action === "FAIL") {
          failures.push(failure)
        } else {
          warnings.push(failure)
        }
      }
    }
  }

  // Sort for deterministic output
  failures.sort((a, b) => a.componentId.localeCompare(b.componentId))
  warnings.sort((a, b) => a.componentId.localeCompare(b.componentId))

  return {
    passed: failures.length === 0,
    failures,
    warnings,
  }
}

/**
 * Formats drift result as markdown for human consumption.
 */
export function formatDriftMarkdown(
  driftResult: DriftResult,
  enforcementResult?: EnforcementResult
): string {
  const lines: string[] = []

  lines.push("# System Registry Drift Report")
  lines.push("")
  lines.push(`> Generated: ${new Date().toISOString()}`)
  lines.push(`> Schema Version: 1.0.0`)
  lines.push("")

  // Summary with clarified metrics
  lines.push("## Summary")
  lines.push("")
  lines.push("| Metric | Count | Description |")
  lines.push("|--------|-------|-------------|")
  lines.push(
    `| Observed (Total) | ${driftResult.summary.observedTotal} | Components found by harvesters |`
  )
  lines.push(
    `| Declared (Total) | ${driftResult.summary.declaredTotal} | Components in registry |`
  )
  lines.push(
    `| Observed Not Declared | ${driftResult.summary.observedNotDeclaredCount} | Shadow systems |`
  )
  lines.push(
    `| Declared Not Observed | ${driftResult.summary.declaredNotObservedCount} | Possible rot |`
  )
  lines.push(
    `| CodeRef Invalid | ${driftResult.summary.codeRefInvalidCount} | Declared paths that don't exist |`
  )
  lines.push(`| Metadata Gaps | ${driftResult.summary.metadataGapCount} | Missing owner/docs/deps |`)
  lines.push(`| Unknown Integrations | ${driftResult.summary.unknownIntegrationCount} | External services needing triage |`)
  lines.push(`| Critical Issues | ${driftResult.summary.criticalIssues} | Requires immediate fix |`)
  lines.push(`| High Issues | ${driftResult.summary.highIssues} | Should fix soon |`)
  lines.push("")

  // Type Coverage Matrix
  lines.push("## Type Coverage Matrix")
  lines.push("")
  lines.push("| Type | Declared | Observed | CodeRef OK | CodeRef Invalid |")
  lines.push("|------|----------|----------|------------|-----------------|")
  for (const tc of driftResult.typeCoverage) {
    lines.push(
      `| ${tc.type} | ${tc.declared} | ${tc.observed} | ${tc.codeRefVerified} | ${tc.codeRefMissing} |`
    )
  }
  lines.push("")

  // Enforcement result
  if (enforcementResult) {
    lines.push("## Enforcement Status")
    lines.push("")
    lines.push(
      enforcementResult.passed
        ? "✅ **PASSED** - All enforcement rules satisfied"
        : "❌ **FAILED** - Enforcement rules violated"
    )
    lines.push("")

    if (enforcementResult.failures.length > 0) {
      lines.push("### Failures (Must Fix)")
      lines.push("")
      for (const f of enforcementResult.failures) {
        lines.push(`- **${f.componentId}** (${f.type}): ${f.message}`)
      }
      lines.push("")
    }

    if (enforcementResult.warnings.length > 0) {
      lines.push("### Warnings")
      lines.push("")
      for (const w of enforcementResult.warnings) {
        lines.push(`- **${w.componentId}** (${w.type}): ${w.message}`)
      }
      lines.push("")
    }
  }

  // Governance Violations (always show if any)
  if (driftResult.governanceViolations.length > 0) {
    lines.push("## Governance Violations")
    lines.push("")
    lines.push("These violations indicate governance.ts integrity issues that MUST be fixed:")
    lines.push("")
    lines.push("| Type | Name | Issue |")
    lines.push("|------|------|-------|")
    for (const v of driftResult.governanceViolations) {
      lines.push(`| ${v.type} | ${v.name} | ${v.issue} |`)
    }
    lines.push("")
  }

  // Unknown Integrations (require triage)
  if (driftResult.unknownIntegrations.length > 0) {
    lines.push("## Unknown Integrations (Require Triage)")
    lines.push("")
    lines.push("External services detected but not declared in governance.ts:")
    lines.push("")
    lines.push("| Component ID | Observed At | Action Required |")
    lines.push("|--------------|-------------|-----------------|")
    for (const d of driftResult.unknownIntegrations) {
      lines.push(`| ${d.componentId} | ${d.observedAt?.join(", ") || "-"} | Declare in governance.ts or add to registry |`)
    }
    lines.push("")
  }

  // Deprecated Owners (migration required)
  if (driftResult.deprecatedOwners.length > 0) {
    lines.push("## Deprecated Owners (Migration Required)")
    lines.push("")
    lines.push("Components using deprecated owner slugs that should migrate:")
    lines.push("")
    lines.push("| Component ID | Current Owner | Migrate To | Reason |")
    lines.push("|--------------|---------------|------------|--------|")
    for (const d of driftResult.deprecatedOwners) {
      lines.push(`| ${d.componentId} | ${d.owner} | ${d.migratesTo} | ${d.reason} |`)
    }
    lines.push("")
  }

  // CodeRef Invalid (critical)
  if (driftResult.codeRefInvalid.length > 0) {
    lines.push("## CodeRef Invalid (Declared paths don't exist)")
    lines.push("")
    lines.push("| Component ID | Type | Risk | Path | Reason |")
    lines.push("|--------------|------|------|------|--------|")
    for (const d of driftResult.codeRefInvalid) {
      lines.push(`| ${d.componentId} | ${d.type} | ${d.risk} | ${d.declaredSource || "-"} | ${d.reason || ""} |`)
    }
    lines.push("")
  }

  // Observed not declared
  if (driftResult.observedNotDeclared.length > 0) {
    lines.push("## Observed Not Declared (Shadow Systems)")
    lines.push("")
    lines.push("| Component ID | Type | Risk |")
    lines.push("|--------------|------|------|")
    for (const d of driftResult.observedNotDeclared) {
      lines.push(`| ${d.componentId} | ${d.type} | ${d.risk} |`)
    }
    lines.push("")
  }

  // Declared not observed
  if (driftResult.declaredNotObserved.length > 0) {
    lines.push("## Declared Not Observed (Possible Rot)")
    lines.push("")
    lines.push("| Component ID | Type | Risk |")
    lines.push("|--------------|------|------|")
    for (const d of driftResult.declaredNotObserved) {
      lines.push(`| ${d.componentId} | ${d.type} | ${d.risk} |`)
    }
    lines.push("")
  }

  // Metadata gaps
  if (driftResult.metadataGaps.length > 0) {
    lines.push("## Metadata Gaps")
    lines.push("")
    lines.push("| Component ID | Type | Gaps |")
    lines.push("|--------------|------|------|")
    for (const d of driftResult.metadataGaps) {
      lines.push(`| ${d.componentId} | ${d.type} | ${d.gaps?.join(", ") || ""} |`)
    }
    lines.push("")
  }

  return lines.join("\n")
}
