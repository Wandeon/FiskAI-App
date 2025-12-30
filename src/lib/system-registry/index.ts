/**
 * System Registry
 *
 * The canonical operational truth for FiskAI.
 *
 * This module provides:
 * - Schema: Type definitions for components, drift, enforcement
 * - Declarations: The source-of-truth component registry
 * - Harvesters: Deterministic code scanners for observed inventory
 * - Drift Detection: Compare observed vs declared
 * - Enforcement: CI gates for registry compliance
 *
 * @example
 * ```typescript
 * import {
 *   DECLARED_COMPONENTS,
 *   CRITICAL_PATHS,
 *   harvestAll,
 *   computeDrift,
 *   enforceRules,
 * } from "@/lib/system-registry"
 *
 * // Get declared components
 * const components = DECLARED_COMPONENTS
 *
 * // Harvest observed components
 * const observed = await harvestAll(projectRoot)
 *
 * // Compute drift
 * const drift = computeDrift(observed.components, components)
 *
 * // Enforce rules
 * const result = enforceRules(drift)
 * ```
 */

// Schema exports
export type {
  ComponentType,
  ComponentStatus,
  ComponentCriticality,
  DependencyType,
  ComponentDependency,
  SystemComponent,
  CriticalPath,
  ObservedComponent,
  DriftEntry,
  EnforcementRule,
} from "./schema"

export {
  COMPONENT_TYPES,
  STATUS_VALUES,
  CRITICALITY_VALUES,
  DEPENDENCY_TYPES,
  DEFAULT_ENFORCEMENT_RULES,
  CRITICAL_ROUTE_GROUPS,
  CRITICAL_JOBS,
  CRITICAL_QUEUES,
} from "./schema"

// Declaration exports
export { ALL_COMPONENTS as DECLARED_COMPONENTS, CRITICAL_PATHS } from "./declarations"

// Harvester exports
export {
  harvestAll,
  harvestRoutes,
  harvestJobs,
  harvestWorkers,
  harvestQueues,
  harvestModules,
} from "./harvesters"

export type { HarvesterResult, FullHarvestResult, HarvesterError } from "./harvesters"

// Drift detection exports
export {
  computeDrift,
  enforceRules,
  formatDriftMarkdown,
} from "./compute-drift"

export type {
  DriftResult,
  EnforcementResult,
  EnforcementFailure,
} from "./compute-drift"

// Dependency graph exports
export {
  buildGraph,
  reverseReachable,
  MAX_NODES,
} from "./dependency-graph"

export type {
  DependencyGraph,
  ReverseReachableResult,
} from "./dependency-graph"

// Blast radius exports
export {
  computeDirectImpact,
  computeTransitiveImpact,
  DEFAULT_MAX_TRANSITIVE_NODES,
} from "./blast-radius"

export type { DirectImpact, MatchType, TransitiveImpact } from "./blast-radius"

// Utility: Get component by ID
export function getComponent(componentId: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DECLARED_COMPONENTS } = require("./declarations")
  return DECLARED_COMPONENTS.find(
    (c: { componentId: string; aliases?: string[] }) =>
      c.componentId === componentId || c.aliases?.includes(componentId)
  )
}

// Utility: Get components by type
export function getComponentsByType(type: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DECLARED_COMPONENTS } = require("./declarations")
  return DECLARED_COMPONENTS.filter((c: { type: string }) => c.type === type)
}

// Utility: Get critical path by ID
export function getCriticalPath(pathId: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CRITICAL_PATHS } = require("./declarations")
  return CRITICAL_PATHS.find((p: { pathId: string }) => p.pathId === pathId)
}

// Utility: Get all components in a critical path
export function getCriticalPathComponents(pathId: string) {
  const path = getCriticalPath(pathId)
  if (!path) return []

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DECLARED_COMPONENTS } = require("./declarations")
  return path.components
    .map((id: string) => getComponent(id))
    .filter(Boolean)
}
