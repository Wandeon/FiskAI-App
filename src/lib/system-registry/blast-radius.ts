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

import type { SystemComponent } from "./schema"
import { ALLOWED_QUEUE_CONSTRUCTOR_PATHS } from "./governance"

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
