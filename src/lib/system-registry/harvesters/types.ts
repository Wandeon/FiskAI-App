/**
 * Harvester Types
 *
 * Common types used by all harvesters.
 * Harvesters are DETERMINISTIC - no LLM heuristics.
 */

import type { ComponentType, ObservedComponent } from "../schema"

export interface HarvesterResult {
  components: ObservedComponent[]
  errors: HarvesterError[]
  metadata: {
    harvesterName: string
    executedAt: string
    durationMs: number
    scanPaths: string[]
  }
}

export interface HarvesterError {
  path: string
  message: string
  recoverable: boolean
}

export interface Harvester {
  name: string
  componentType: ComponentType
  harvest(): Promise<HarvesterResult>
}

/**
 * Creates a standardized ObservedComponent from harvester data.
 */
export function createObservedComponent(
  componentId: string,
  type: ComponentType,
  name: string,
  observedAt: string[],
  discoveryMethod: ObservedComponent["discoveryMethod"],
  metadata?: Record<string, unknown>
): ObservedComponent {
  return {
    componentId,
    type,
    name,
    observedAt,
    discoveryMethod,
    ...(metadata && { metadata }),
  }
}

/**
 * Converts a directory name to a component ID.
 * Example: "fiscal-processor" -> "job-fiscal-processor"
 */
export function toComponentId(type: ComponentType, name: string): string {
  const prefix = type.toLowerCase().replace("_", "-")
  const kebabName = name
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "")
    .replace(/\s+/g, "-")
  return `${prefix}-${kebabName}`
}
