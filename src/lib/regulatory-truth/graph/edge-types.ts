// src/lib/regulatory-truth/graph/edge-types.ts
/**
 * Edge Types for the Statutory Reference Graph (SRG)
 *
 * Types are separated from implementations to avoid database imports
 * in unit test contexts.
 */

import type { GraphEdgeType } from "@prisma/client"

export interface EdgeBuildResult {
  ruleId: string
  supersedes: {
    created: number
    deleted: number
    errors: string[]
  }
  overrides: {
    created: number
    deleted: number
    errors: string[]
  }
  dependsOn: {
    created: number
    deleted: number
    errors: string[]
  }
  totalEdges: number
}

export interface EdgeTrace {
  selectedRuleId: string
  traversedEdges: Array<{
    from: string
    to: string
    type: GraphEdgeType
    direction: "outgoing" | "incoming"
  }>
  supersessionChain: string[]
  overriddenBy: string[]
  conflicts?: {
    ruleIds: string[]
    reason: string
  }
}
