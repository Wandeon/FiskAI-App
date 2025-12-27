// src/lib/regulatory-truth/graph/cycle-detection.ts
// Cycle Prevention for Precedence Edges in the Regulatory Truth Layer Graph

import { db } from "@/lib/db"
import type { GraphEdgeType } from "@prisma/client"

/**
 * Edge types that represent precedence relationships where cycles would be invalid.
 * These edge types establish ordering relationships that must be acyclic:
 * - SUPERSEDES: A newer rule replaces an older one (temporal ordering)
 * - OVERRIDES: A specific rule takes precedence over a general one (lex specialis)
 * - AMENDS: A rule modifies another rule
 * - DEPENDS_ON: A rule depends on another rule's evaluation
 * - REQUIRES: A rule requires another rule to be satisfied
 */
const PRECEDENCE_EDGE_TYPES: GraphEdgeType[] = [
  "SUPERSEDES",
  "OVERRIDES",
  "AMENDS",
  "DEPENDS_ON",
  "REQUIRES",
]

/**
 * Check if adding an edge from fromId to toId would create a cycle in the precedence graph.
 *
 * Uses BFS to check if there's already a path from toId to fromId. If such a path exists,
 * adding an edge fromId -> toId would create a cycle.
 *
 * @param fromId - The source rule ID for the proposed edge
 * @param toId - The target rule ID for the proposed edge
 * @param edgeType - Optional: only consider edges of this type (defaults to all precedence types)
 * @returns true if adding this edge would create a cycle, false otherwise
 */
export async function wouldCreateCycle(
  fromId: string,
  toId: string,
  edgeType?: GraphEdgeType
): Promise<boolean> {
  // Self-loop is always a cycle
  if (fromId === toId) {
    return true
  }

  const edgeTypes = edgeType ? [edgeType] : PRECEDENCE_EDGE_TYPES

  // BFS from toId to see if we can reach fromId
  const visited = new Set<string>()
  const queue: string[] = [toId]

  while (queue.length > 0) {
    const current = queue.shift()!

    if (visited.has(current)) {
      continue
    }
    visited.add(current)

    // If we reached the source of the proposed edge, adding it would create a cycle
    if (current === fromId) {
      return true
    }

    // Get all outgoing edges from the current node (following precedence direction)
    const outgoingEdges = await db.graphEdge.findMany({
      where: {
        fromRuleId: current,
        relation: { in: edgeTypes },
      },
      select: { toRuleId: true },
    })

    for (const edge of outgoingEdges) {
      if (!visited.has(edge.toRuleId)) {
        queue.push(edge.toRuleId)
      }
    }
  }

  return false
}

/**
 * Error thrown when attempting to create an edge that would introduce a cycle
 */
export class CycleDetectedError extends Error {
  readonly fromId: string
  readonly toId: string
  readonly edgeType: GraphEdgeType

  constructor(fromId: string, toId: string, edgeType: GraphEdgeType) {
    super(
      `Cannot create ${edgeType} edge from ${fromId} to ${toId}: would create a cycle in the precedence graph`
    )
    this.name = "CycleDetectedError"
    this.fromId = fromId
    this.toId = toId
    this.edgeType = edgeType
  }
}

/**
 * Create a graph edge with cycle prevention.
 * Checks for cycles before creating the edge and throws CycleDetectedError if one would be created.
 *
 * @param data - The edge data to create
 * @returns The created edge
 * @throws CycleDetectedError if adding this edge would create a cycle
 */
export async function createEdgeWithCycleCheck(data: {
  fromRuleId: string
  toRuleId: string
  relation: GraphEdgeType
  validFrom: Date
  validTo?: Date | null
  notes?: string | null
}): Promise<{ id: string }> {
  // Only check for cycles with precedence edge types
  if (PRECEDENCE_EDGE_TYPES.includes(data.relation)) {
    const wouldCycle = await wouldCreateCycle(data.fromRuleId, data.toRuleId, data.relation)
    if (wouldCycle) {
      throw new CycleDetectedError(data.fromRuleId, data.toRuleId, data.relation)
    }
  }

  return db.graphEdge.create({
    data: {
      fromRuleId: data.fromRuleId,
      toRuleId: data.toRuleId,
      relation: data.relation,
      validFrom: data.validFrom,
      validTo: data.validTo,
      notes: data.notes,
    },
    select: { id: true },
  })
}

/**
 * Validate that the existing graph has no cycles.
 * This is useful for health checks and data integrity verification.
 *
 * Uses Kahn's algorithm (topological sort) to detect cycles.
 *
 * @param edgeTypes - Edge types to consider (defaults to all precedence types)
 * @returns Object with isValid flag and any cycle details found
 */
export async function validateGraphAcyclicity(
  edgeTypes: GraphEdgeType[] = PRECEDENCE_EDGE_TYPES
): Promise<{
  isValid: boolean
  cycleNodes?: string[]
  edgeCount: number
  nodeCount: number
}> {
  // Fetch all edges of the specified types
  const edges = await db.graphEdge.findMany({
    where: { relation: { in: edgeTypes } },
    select: { fromRuleId: true, toRuleId: true },
  })

  if (edges.length === 0) {
    return { isValid: true, edgeCount: 0, nodeCount: 0 }
  }

  // Build adjacency list and in-degree map
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  const allNodes = new Set<string>()

  for (const edge of edges) {
    allNodes.add(edge.fromRuleId)
    allNodes.add(edge.toRuleId)

    if (!adjacency.has(edge.fromRuleId)) {
      adjacency.set(edge.fromRuleId, [])
    }
    adjacency.get(edge.fromRuleId)!.push(edge.toRuleId)

    inDegree.set(edge.toRuleId, (inDegree.get(edge.toRuleId) || 0) + 1)
    if (!inDegree.has(edge.fromRuleId)) {
      inDegree.set(edge.fromRuleId, 0)
    }
  }

  // Initialize queue with nodes having no incoming edges
  const queue: string[] = []
  for (const node of allNodes) {
    if ((inDegree.get(node) || 0) === 0) {
      queue.push(node)
    }
  }

  let processedCount = 0
  while (queue.length > 0) {
    const node = queue.shift()!
    processedCount++

    const neighbors = adjacency.get(node) || []
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) {
        queue.push(neighbor)
      }
    }
  }

  // If we didn't process all nodes, there's a cycle
  if (processedCount < allNodes.size) {
    // Find nodes that are part of cycles (those with remaining in-degree > 0)
    const cycleNodes: string[] = []
    for (const [node, degree] of inDegree.entries()) {
      if (degree > 0) {
        cycleNodes.push(node)
      }
    }

    return {
      isValid: false,
      cycleNodes,
      edgeCount: edges.length,
      nodeCount: allNodes.size,
    }
  }

  return {
    isValid: true,
    edgeCount: edges.length,
    nodeCount: allNodes.size,
  }
}

/**
 * Find the path from one rule to another if it exists.
 * Useful for debugging and understanding rule relationships.
 *
 * @param fromId - Starting rule ID
 * @param toId - Target rule ID
 * @param edgeTypes - Edge types to consider
 * @returns Array of rule IDs forming the path, or null if no path exists
 */
export async function findPath(
  fromId: string,
  toId: string,
  edgeTypes: GraphEdgeType[] = PRECEDENCE_EDGE_TYPES
): Promise<string[] | null> {
  if (fromId === toId) {
    return [fromId]
  }

  const visited = new Set<string>()
  const parent = new Map<string, string>()
  const queue: string[] = [fromId]

  while (queue.length > 0) {
    const current = queue.shift()!

    if (visited.has(current)) {
      continue
    }
    visited.add(current)

    if (current === toId) {
      // Reconstruct path
      const path: string[] = [toId]
      let node = toId
      while (parent.has(node)) {
        node = parent.get(node)!
        path.unshift(node)
      }
      return path
    }

    const outgoingEdges = await db.graphEdge.findMany({
      where: {
        fromRuleId: current,
        relation: { in: edgeTypes },
      },
      select: { toRuleId: true },
    })

    for (const edge of outgoingEdges) {
      if (!visited.has(edge.toRuleId)) {
        parent.set(edge.toRuleId, current)
        queue.push(edge.toRuleId)
      }
    }
  }

  return null
}
