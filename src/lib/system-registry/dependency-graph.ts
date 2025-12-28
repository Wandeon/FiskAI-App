/**
 * Dependency Graph Module
 *
 * Builds and queries dependency relationships between components.
 * Used for computing "blast radius" - what components might be affected
 * when a given component changes.
 *
 * Edge direction semantics:
 * - dependsOn[A] = list of components that A depends on
 * - usedBy[A] = list of components that depend on A (reverse of dependsOn)
 * - If A depends on B, then changes to B may break A
 *
 * @example
 * ```typescript
 * import { buildGraph, reverseReachable } from "@/lib/system-registry/dependency-graph"
 *
 * const graph = buildGraph(components)
 *
 * // Find all components that depend on "store-postgresql"
 * const result = reverseReachable(graph, ["store-postgresql"])
 * // result.components = ["lib-auth", "module-invoicing", "ui-portal-app", ...]
 * ```
 */

import type { SystemComponent } from "./schema"

/**
 * Maximum number of nodes to return from traversal.
 * Prevents unbounded memory usage on large graphs.
 */
export const MAX_NODES = 50

/**
 * Dependency graph with forward and reverse edges.
 */
export interface DependencyGraph {
  /**
   * Forward edges: for each component ID, the list of component IDs it depends on.
   * If A depends on B, then dependsOn.get("A") includes "B".
   */
  dependsOn: Map<string, string[]>

  /**
   * Reverse edges: for each component ID, the list of component IDs that depend on it.
   * If A depends on B, then usedBy.get("B") includes "A".
   */
  usedBy: Map<string, string[]>
}

/**
 * Result of a reverse reachability query.
 */
export interface ReverseReachableResult {
  /**
   * Component IDs reachable by following reverse edges from start nodes.
   * Does NOT include the start nodes themselves.
   * Sorted alphabetically for deterministic output.
   */
  components: string[]

  /**
   * True if the traversal was capped at MAX_NODES.
   */
  truncated: boolean
}

/**
 * Builds a dependency graph from declared components.
 *
 * @param components - Array of declared components with dependencies
 * @returns DependencyGraph with forward and reverse edges
 */
export function buildGraph(components: SystemComponent[]): DependencyGraph {
  const dependsOn = new Map<string, string[]>()
  const usedBy = new Map<string, string[]>()

  // Initialize empty arrays for all component IDs
  for (const component of components) {
    const id = component.componentId
    if (!dependsOn.has(id)) {
      dependsOn.set(id, [])
    }
    if (!usedBy.has(id)) {
      usedBy.set(id, [])
    }
  }

  // Build forward edges from dependencies
  for (const component of components) {
    const sourceId = component.componentId
    const deps: string[] = []

    for (const dep of component.dependencies) {
      const targetId = dep.componentId
      deps.push(targetId)

      // Ensure target exists in maps (may be external/undeclared)
      if (!usedBy.has(targetId)) {
        usedBy.set(targetId, [])
      }
      if (!dependsOn.has(targetId)) {
        dependsOn.set(targetId, [])
      }

      // Add reverse edge: targetId is used by sourceId
      const users = usedBy.get(targetId)!
      if (!users.includes(sourceId)) {
        users.push(sourceId)
      }
    }

    // Set forward edges for this component
    dependsOn.set(sourceId, deps)
  }

  return { dependsOn, usedBy }
}

/**
 * Finds all components transitively reachable by following reverse edges.
 *
 * Given a set of start nodes, finds all components that (directly or indirectly)
 * depend on those start nodes. Uses BFS traversal with cycle detection.
 *
 * Use case: "If I change component X, what else might break?"
 * Answer: reverseReachable(graph, ["X"]) gives all components that depend on X.
 *
 * @param graph - The dependency graph to traverse
 * @param startNodes - Component IDs to start traversal from
 * @param maxNodes - Maximum number of nodes to return (default: MAX_NODES)
 * @returns Object with reachable components (excluding start nodes) and truncation flag
 */
export function reverseReachable(
  graph: DependencyGraph,
  startNodes: string[],
  maxNodes: number = MAX_NODES
): ReverseReachableResult {
  const result: string[] = []
  const visited = new Set<string>()

  // Mark start nodes as visited but don't include in results
  for (const node of startNodes) {
    visited.add(node)
  }

  // BFS queue - start with all reverse edges from start nodes
  const queue: string[] = []

  for (const startNode of startNodes) {
    const users = graph.usedBy.get(startNode)
    if (users) {
      for (const user of users) {
        if (!visited.has(user)) {
          queue.push(user)
        }
      }
    }
  }

  // BFS traversal with cycle detection
  while (queue.length > 0) {
    // Check if we've hit the cap
    if (result.length >= maxNodes) {
      return {
        components: result.sort(),
        truncated: true,
      }
    }

    const current = queue.shift()!

    // Skip if already visited (handles cycles)
    if (visited.has(current)) {
      continue
    }

    visited.add(current)
    result.push(current)

    // Add all users of current node to queue
    const users = graph.usedBy.get(current)
    if (users) {
      for (const user of users) {
        if (!visited.has(user)) {
          queue.push(user)
        }
      }
    }
  }

  return {
    components: result.sort(),
    truncated: false,
  }
}
