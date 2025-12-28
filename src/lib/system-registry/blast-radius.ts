/**
 * Blast Radius - Direct Impact Matching
 *
 * Maps changed files to affected components using codeRef matching.
 * This is Phase 3 of the System Registry project - building "Change Intelligence"
 * for PR blast radius computation.
 *
 * Task 3: Given a list of changed files (from git diff), map them to components
 * that are directly affected. This is the first step before computing transitive impact.
 *
 * Matching rules by component type:
 * 1. LIB/INTEGRATION: File starts with codeRef or any codeRefs[] prefix
 * 2. ROUTE_GROUP: File under src/app/api/<group>/ where group is extracted from component id
 * 3. WORKER: File matches worker codeRef path
 * 4. QUEUE: File matches allowlisted queue factory path (from governance)
 * 5. MODULE/UI/JOB/STORE: File starts with codeRef or any codeRefs[] prefix
 *
 * @example
 * ```typescript
 * import { computeDirectImpact } from "@/lib/system-registry/blast-radius"
 *
 * const changedFiles = ["src/lib/auth/session.ts", "src/app/api/billing/route.ts"]
 * const impacts = computeDirectImpact(changedFiles, DECLARED_COMPONENTS)
 *
 * // impacts = [
 * //   { component: lib-auth, matchedFiles: ["src/lib/auth/session.ts"], matchType: "codeRef" },
 * //   { component: route-group-billing, matchedFiles: ["src/app/api/billing/route.ts"], matchType: "route_group" },
 * // ]
 * ```
 */

import type { SystemComponent, CriticalPath } from "./schema"
import { ALLOWED_QUEUE_CONSTRUCTOR_PATHS } from "./governance"
import type { DependencyGraph } from "./dependency-graph"

/**
 * Type of match that linked a file to a component.
 * Useful for debugging and understanding why a component was matched.
 */
export type MatchType =
  | "codeRef"
  | "codeRefs"
  | "route_group"
  | "worker"
  | "integration"
  | "queue"

/**
 * A component directly impacted by file changes.
 */
export interface DirectImpact {
  /** The affected component */
  component: SystemComponent

  /** Files that matched this component */
  matchedFiles: string[]

  /** How the match was determined */
  matchType: MatchType
}

/**
 * A component transitively impacted through dependency chains.
 * These are components that depend (directly or indirectly) on directly impacted components.
 */
export interface TransitiveImpact {
  /** The transitively affected component */
  component: SystemComponent

  /** Number of hops from the nearest direct impact (1 = directly depends on a direct impact) */
  distance: number

  /** Component chain showing how this component was reached from a direct impact */
  pathThrough: string[]
}

/**
 * Normalizes a file path by removing leading "./" if present.
 */
function normalizePath(path: string): string {
  return path.startsWith("./") ? path.slice(2) : path
}

/**
 * Extracts the route group name from a component ID.
 * E.g., "route-group-auth" -> "auth"
 *       "route-group-e-invoices" -> "e-invoices"
 */
function extractRouteGroupName(componentId: string): string | null {
  const prefix = "route-group-"
  if (!componentId.startsWith(prefix)) {
    return null
  }
  return componentId.slice(prefix.length)
}

/**
 * Checks if a file path starts with a given prefix.
 * Handles trailing slashes in prefixes correctly.
 */
function fileStartsWithPrefix(filePath: string, prefix: string): boolean {
  const normalizedFile = normalizePath(filePath)
  const normalizedPrefix = normalizePath(prefix)

  // Direct prefix match
  if (normalizedFile.startsWith(normalizedPrefix)) {
    return true
  }

  // Handle case where prefix has trailing slash but file doesn't need it
  // e.g., prefix="src/lib/auth/" file="src/lib/auth/session.ts"
  const prefixWithoutTrailingSlash = normalizedPrefix.endsWith("/")
    ? normalizedPrefix.slice(0, -1)
    : normalizedPrefix

  // Check if file is exactly the prefix (for single-file codeRefs)
  // e.g., codeRef="src/lib/fiscal/porezna-client.ts" file="src/lib/fiscal/porezna-client.ts"
  if (normalizedFile === prefixWithoutTrailingSlash) {
    return true
  }

  // Check if file is under the prefix directory
  // e.g., prefix="src/lib/auth" file="src/lib/auth/session.ts"
  if (normalizedFile.startsWith(prefixWithoutTrailingSlash + "/")) {
    return true
  }

  return false
}

/**
 * Matches a file against a component's codeRef.
 * Returns true if the file is under the codeRef path.
 */
function matchCodeRef(
  file: string,
  component: SystemComponent
): { matched: boolean; matchType: MatchType } {
  // Check primary codeRef
  if (component.codeRef && fileStartsWithPrefix(file, component.codeRef)) {
    return { matched: true, matchType: "codeRef" }
  }

  // Check additional codeRefs
  if (component.codeRefs && component.codeRefs.length > 0) {
    for (const ref of component.codeRefs) {
      if (fileStartsWithPrefix(file, ref)) {
        return { matched: true, matchType: "codeRefs" }
      }
    }
  }

  return { matched: false, matchType: "codeRef" }
}

/**
 * Matches a file against a ROUTE_GROUP component.
 * Route groups are matched by the pattern src/app/api/<group>/
 */
function matchRouteGroup(file: string, component: SystemComponent): boolean {
  const groupName = extractRouteGroupName(component.componentId)
  if (!groupName) {
    return false
  }

  const routePrefix = `src/app/api/${groupName}/`
  return fileStartsWithPrefix(file, routePrefix)
}

/**
 * Matches a file against a WORKER component.
 * Workers are matched by their codeRef path.
 */
function matchWorker(file: string, component: SystemComponent): boolean {
  // Workers match via codeRef (their worker file path)
  if (component.codeRef && fileStartsWithPrefix(file, component.codeRef)) {
    return true
  }

  // Also check codeRefs for multi-file workers
  if (component.codeRefs) {
    for (const ref of component.codeRefs) {
      if (fileStartsWithPrefix(file, ref)) {
        return true
      }
    }
  }

  return false
}

/**
 * Matches a file against a QUEUE component.
 * Queues are matched if the file is in the allowed queue constructor paths.
 */
function matchQueue(file: string, component: SystemComponent): boolean {
  const normalizedFile = normalizePath(file)

  // Check if file is in allowed queue factory paths
  for (const allowedPath of ALLOWED_QUEUE_CONSTRUCTOR_PATHS) {
    if (normalizedFile === allowedPath || fileStartsWithPrefix(file, allowedPath)) {
      // For queues, we also need to check if this is the right queue component
      // by checking if the component's codeRef matches
      if (component.codeRef && fileStartsWithPrefix(file, component.codeRef)) {
        return true
      }
    }
  }

  return false
}

/**
 * Matches a file against an INTEGRATION component.
 * Integrations are typically under src/lib/integrations/<name>/ or have specific codeRefs.
 */
function matchIntegration(
  file: string,
  component: SystemComponent
): { matched: boolean; matchType: MatchType } {
  // Check primary codeRef
  if (component.codeRef && fileStartsWithPrefix(file, component.codeRef)) {
    return { matched: true, matchType: "integration" }
  }

  // Check additional codeRefs
  if (component.codeRefs && component.codeRefs.length > 0) {
    for (const ref of component.codeRefs) {
      if (fileStartsWithPrefix(file, ref)) {
        return { matched: true, matchType: "integration" }
      }
    }
  }

  return { matched: false, matchType: "integration" }
}

/**
 * Matches a file against a component based on its type.
 */
function matchFile(
  file: string,
  component: SystemComponent
): { matched: boolean; matchType: MatchType } {
  const type = component.type

  switch (type) {
    case "ROUTE_GROUP":
      // Route groups use special matching based on component ID
      if (matchRouteGroup(file, component)) {
        return { matched: true, matchType: "route_group" }
      }
      // Also fall through to codeRef matching if route group has explicit codeRef
      return matchCodeRef(file, component)

    case "WORKER":
      if (matchWorker(file, component)) {
        return { matched: true, matchType: "worker" }
      }
      return { matched: false, matchType: "worker" }

    case "QUEUE":
      if (matchQueue(file, component)) {
        return { matched: true, matchType: "queue" }
      }
      return { matched: false, matchType: "queue" }

    case "INTEGRATION":
      return matchIntegration(file, component)

    case "LIB":
    case "MODULE":
    case "UI":
    case "JOB":
    case "STORE":
    default:
      // Standard codeRef matching
      return matchCodeRef(file, component)
  }
}

/**
 * Computes direct impact of changed files on components.
 *
 * For each changed file, finds all components whose codeRef or codeRefs
 * match the file path. A file can match multiple components (overlapping codeRefs).
 *
 * @param changedFiles - List of file paths that changed (from git diff)
 * @param components - List of declared components to match against
 * @returns Array of DirectImpact objects, one per affected component
 */
export function computeDirectImpact(
  changedFiles: string[],
  components: SystemComponent[]
): DirectImpact[] {
  // Map to accumulate matches: componentId -> { component, files, matchType }
  const impactMap = new Map<
    string,
    { component: SystemComponent; files: string[]; matchType: MatchType }
  >()

  for (const file of changedFiles) {
    for (const component of components) {
      const { matched, matchType } = matchFile(file, component)

      if (matched) {
        const existing = impactMap.get(component.componentId)
        if (existing) {
          // Add file to existing impact
          if (!existing.files.includes(file)) {
            existing.files.push(file)
          }
        } else {
          // Create new impact entry
          impactMap.set(component.componentId, {
            component,
            files: [file],
            matchType,
          })
        }
      }
    }
  }

  // Convert map to array of DirectImpact
  const results: DirectImpact[] = []
  for (const { component, files, matchType } of impactMap.values()) {
    results.push({
      component,
      matchedFiles: files.sort(), // Sort for deterministic output
      matchType,
    })
  }

  // Sort by component ID for deterministic output
  return results.sort((a, b) =>
    a.component.componentId.localeCompare(b.component.componentId)
  )
}

/**
 * Default maximum number of transitive impact nodes to return.
 * Prevents unbounded memory usage on large dependency graphs.
 */
export const DEFAULT_MAX_TRANSITIVE_NODES = 50

/**
 * Computes transitive impact from directly affected components.
 *
 * Given a set of directly impacted component IDs, finds all components that
 * (directly or indirectly) depend on those components. Uses BFS traversal
 * to track distance and path from the nearest direct impact.
 *
 * Semantics:
 * - If A depends on B, changes to B affect A
 * - Direct components are NOT included in transitive results
 * - Distance 1 = directly depends on a direct component
 * - Distance 2 = depends on something that depends on a direct component
 *
 * @param directComponents - Component IDs that are directly impacted
 * @param graph - The dependency graph to traverse
 * @param components - All declared system components (for lookup)
 * @param maxNodes - Maximum number of transitive impacts to return (default: 50)
 * @returns Object with transitive impacts and truncation flag
 *
 * @example
 * ```typescript
 * const direct = computeDirectImpact(changedFiles, components)
 * const directIds = direct.map(d => d.component.componentId)
 * const graph = buildGraph(components)
 *
 * const { impacts, truncated } = computeTransitiveImpact(
 *   directIds,
 *   graph,
 *   components
 * )
 *
 * // impacts = [
 * //   { component: lib-auth, distance: 1, pathThrough: ["store-postgresql"] },
 * //   { component: ui-portal, distance: 2, pathThrough: ["store-postgresql", "lib-auth"] },
 * // ]
 * ```
 */
export function computeTransitiveImpact(
  directComponents: string[],
  graph: DependencyGraph,
  components: SystemComponent[],
  maxNodes: number = DEFAULT_MAX_TRANSITIVE_NODES
): {
  impacts: TransitiveImpact[]
  truncated: boolean
} {
  // Build lookup map for components
  const componentMap = new Map<string, SystemComponent>()
  for (const c of components) {
    componentMap.set(c.componentId, c)
  }

  // Track visited nodes and their metadata
  const visited = new Set<string>()
  const result: TransitiveImpact[] = []

  // Mark direct components as visited (they are excluded from transitive results)
  for (const id of directComponents) {
    visited.add(id)
  }

  // BFS queue: [componentId, distance, pathThrough]
  // pathThrough is the chain of component IDs from direct impact to this node
  const queue: Array<{ id: string; distance: number; pathThrough: string[] }> =
    []

  // Seed queue with components that directly depend on direct components
  for (const directId of directComponents) {
    const users = graph.usedBy.get(directId)
    if (users) {
      for (const userId of users) {
        if (!visited.has(userId)) {
          queue.push({
            id: userId,
            distance: 1,
            pathThrough: [directId],
          })
        }
      }
    }
  }

  // BFS traversal
  while (queue.length > 0) {
    // Check if we've hit the cap
    if (result.length >= maxNodes) {
      return {
        impacts: result.sort((a, b) =>
          a.component.componentId.localeCompare(b.component.componentId)
        ),
        truncated: true,
      }
    }

    const { id: currentId, distance, pathThrough } = queue.shift()!

    // Skip if already visited (handles cycles and duplicate paths)
    if (visited.has(currentId)) {
      continue
    }

    visited.add(currentId)

    // Look up the component
    const component = componentMap.get(currentId)
    if (!component) {
      // Component referenced in graph but not in components list (undeclared dependency)
      // Still track it in visited to prevent cycles, but don't add to results
      continue
    }

    // Add to results
    result.push({
      component,
      distance,
      pathThrough,
    })

    // Add dependents of this node to the queue
    const users = graph.usedBy.get(currentId)
    if (users) {
      for (const userId of users) {
        if (!visited.has(userId)) {
          queue.push({
            id: userId,
            distance: distance + 1,
            pathThrough: [...pathThrough, currentId],
          })
        }
      }
    }
  }

  return {
    impacts: result.sort((a, b) =>
      a.component.componentId.localeCompare(b.component.componentId)
    ),
    truncated: false,
  }
}

/**
 * Represents the impact on a critical path when components change.
 *
 * Critical paths are business-critical flows (billing, fiscalization, auth, etc.)
 * that need special attention when changes affect them.
 */
export interface CriticalPathImpact {
  /** Name of the critical path (from CriticalPath.name) */
  pathName: string

  /** Path ID for reference (from CriticalPath.pathId) */
  pathId: string

  /**
   * Distance to the critical path:
   * - 0 if a direct impact component is on the critical path
   * - N if the nearest transitive impact component is N hops away
   */
  distance: number

  /** List of component IDs in this path that are affected */
  impactedComponents: string[]
}

/**
 * Computes which critical paths are impacted by a set of changes.
 *
 * For each critical path, checks if any of its components appear in either:
 * 1. Direct impacts (distance = 0)
 * 2. Transitive impacts (distance = min distance from transitive impacts)
 *
 * @param directComponents - Component IDs that are directly impacted
 * @param transitiveImpacts - Transitive impact results from computeTransitiveImpact
 * @param criticalPaths - Critical path definitions to check against
 * @returns Array of CriticalPathImpact, one per affected critical path
 *
 * @example
 * ```typescript
 * const direct = computeDirectImpact(changedFiles, components)
 * const directIds = direct.map(d => d.component.componentId)
 * const { impacts: transitive } = computeTransitiveImpact(directIds, graph, components)
 *
 * const criticalPathImpacts = computeCriticalPathImpacts(
 *   directIds,
 *   transitive,
 *   CRITICAL_PATHS
 * )
 *
 * // criticalPathImpacts = [
 * //   { pathName: "Billing Path", pathId: "path-billing", distance: 0, impactedComponents: ["lib-billing"] },
 * //   { pathName: "Authentication Path", pathId: "path-authentication", distance: 2, impactedComponents: ["lib-auth"] },
 * // ]
 * ```
 */
export function computeCriticalPathImpacts(
  directComponents: string[],
  transitiveImpacts: TransitiveImpact[],
  criticalPaths: CriticalPath[]
): CriticalPathImpact[] {
  // Handle empty inputs
  if (criticalPaths.length === 0) {
    return []
  }

  if (directComponents.length === 0 && transitiveImpacts.length === 0) {
    return []
  }

  // Create a set of direct components for O(1) lookup
  const directSet = new Set(directComponents)

  // Create a map of transitive component ID -> minimum distance
  const transitiveDistanceMap = new Map<string, number>()
  for (const impact of transitiveImpacts) {
    const componentId = impact.component.componentId
    const existingDistance = transitiveDistanceMap.get(componentId)
    if (existingDistance === undefined || impact.distance < existingDistance) {
      transitiveDistanceMap.set(componentId, impact.distance)
    }
  }

  const results: CriticalPathImpact[] = []

  for (const path of criticalPaths) {
    const impactedComponents: string[] = []
    let minDistance: number | null = null

    // Check each component in the critical path
    for (const componentId of path.components) {
      // Check if it's a direct impact (distance = 0)
      if (directSet.has(componentId)) {
        impactedComponents.push(componentId)
        if (minDistance === null || 0 < minDistance) {
          minDistance = 0
        }
        continue
      }

      // Check if it's a transitive impact
      const transitiveDistance = transitiveDistanceMap.get(componentId)
      if (transitiveDistance !== undefined) {
        impactedComponents.push(componentId)
        if (minDistance === null || transitiveDistance < minDistance) {
          minDistance = transitiveDistance
        }
      }
    }

    // Only include path if at least one component is affected
    if (impactedComponents.length > 0 && minDistance !== null) {
      results.push({
        pathName: path.name,
        pathId: path.pathId,
        distance: minDistance,
        impactedComponents: impactedComponents.sort(), // Sort for deterministic output
      })
    }
  }

  // Sort by pathId for deterministic output
  return results.sort((a, b) => a.pathId.localeCompare(b.pathId))
}

/**
 * Criticality levels used for blast score computation.
 * Re-exported for convenience (same as ComponentCriticality).
 */
export type Criticality = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

/**
 * Ordered criticality levels from lowest to highest.
 * Used for tier progression and bumping.
 */
const CRITICALITY_ORDER: Criticality[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

/**
 * A tier bump that was applied during blast score computation.
 */
export interface TierBump {
  /** Reason for the bump */
  reason: string
  /** Criticality before the bump */
  from: Criticality
  /** Criticality after the bump */
  to: Criticality
}

/**
 * Result of blast score computation.
 * Contains the final score, base score, and any bumps applied.
 */
export interface BlastScore {
  /** Final computed criticality after all bumps */
  score: Criticality
  /** Initial criticality based on max of direct components */
  baseScore: Criticality
  /** List of tier bumps that were applied */
  bumps: TierBump[]
}

/**
 * Gets the next tier up from the given criticality.
 * Returns the same tier if already at CRITICAL (ceiling).
 */
function bumpTier(criticality: Criticality): Criticality {
  const index = CRITICALITY_ORDER.indexOf(criticality)
  // CRITICAL is the ceiling - can't go higher
  if (index >= CRITICALITY_ORDER.length - 1) {
    return criticality
  }
  return CRITICALITY_ORDER[index + 1]
}

/**
 * Checks if any direct impact component is owned by team:security.
 */
function hasSecurityOwner(directImpacts: DirectImpact[]): boolean {
  for (const impact of directImpacts) {
    if (impact.component.owner === "team:security") {
      return true
    }
  }
  return false
}

/**
 * Computes the blast score for a set of changes.
 *
 * The scoring system aggregates all impact information into a single
 * criticality score that determines enforcement behavior.
 *
 * Bump rules:
 * 1. Base = max criticality of direct components (defaults to LOW if no direct impacts)
 * 2. +1 tier if any critical path is impacted
 * 3. +1 tier if team:security is owner of any directly impacted component
 * 4. +1 tier if governance issues exist
 *
 * Tier progression: LOW -> MEDIUM -> HIGH -> CRITICAL
 * CRITICAL is the ceiling (cannot be bumped higher).
 *
 * @param directImpacts - Components directly affected by file changes
 * @param criticalPathImpacts - Critical paths that are affected
 * @param governanceIssues - List of governance issues (e.g., missing owners)
 * @returns BlastScore with final score, base score, and bump history
 *
 * @example
 * ```typescript
 * const direct = computeDirectImpact(changedFiles, components)
 * const { impacts: transitive } = computeTransitiveImpact(directIds, graph, components)
 * const criticalPaths = computeCriticalPathImpacts(directIds, transitive, CRITICAL_PATHS)
 *
 * const blastScore = computeBlastScore(direct, criticalPaths, [])
 *
 * // blastScore = {
 * //   score: "HIGH",
 * //   baseScore: "MEDIUM",
 * //   bumps: [{ reason: "Critical path impacted: Billing Path", from: "MEDIUM", to: "HIGH" }]
 * // }
 * ```
 */
export function computeBlastScore(
  directImpacts: DirectImpact[],
  criticalPathImpacts: CriticalPathImpact[],
  governanceIssues: string[]
): BlastScore {
  const bumps: TierBump[] = []

  // Step 1: Compute base score from max criticality of direct components
  let baseScore: Criticality = "LOW"
  for (const impact of directImpacts) {
    const criticality = impact.component.criticality as Criticality
    const currentIndex = CRITICALITY_ORDER.indexOf(baseScore)
    const impactIndex = CRITICALITY_ORDER.indexOf(criticality)
    if (impactIndex > currentIndex) {
      baseScore = criticality
    }
  }

  let currentScore = baseScore

  // Step 2: +1 tier if any critical path is impacted
  if (criticalPathImpacts.length > 0) {
    const newScore = bumpTier(currentScore)
    if (newScore !== currentScore) {
      const pathNames = criticalPathImpacts.map((p) => p.pathName).join(", ")
      bumps.push({
        reason: `Critical path impacted: ${pathNames}`,
        from: currentScore,
        to: newScore,
      })
      currentScore = newScore
    }
  }

  // Step 3: +1 tier if team:security is owner of any directly impacted component
  if (hasSecurityOwner(directImpacts)) {
    const newScore = bumpTier(currentScore)
    if (newScore !== currentScore) {
      bumps.push({
        reason: "Security team owns impacted component",
        from: currentScore,
        to: newScore,
      })
      currentScore = newScore
    }
  }

  // Step 4: +1 tier if governance issues exist
  if (governanceIssues.length > 0) {
    const newScore = bumpTier(currentScore)
    if (newScore !== currentScore) {
      bumps.push({
        reason: `Governance issues: ${governanceIssues.join(", ")}`,
        from: currentScore,
        to: newScore,
      })
      currentScore = newScore
    }
  }

  return {
    score: currentScore,
    baseScore,
    bumps,
  }
}
