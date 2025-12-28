/**
 * System Registry Schema
 *
 * This is the canonical type system for the FiskAI System Registry.
 * All components must be declared using these types.
 *
 * GOVERNANCE RULES:
 * - CRITICAL components MUST have owner !== null
 * - HIGH components MUST have owner assigned within 14 days
 * - Component IDs are STABLE - name can change, ID cannot
 * - IDs follow pattern: {type}-{name-kebab}
 */

export const COMPONENT_TYPES = [
  "UI",
  "MODULE",
  "ROUTE_GROUP",
  "WORKER",
  "JOB",
  "QUEUE",
  "STORE",
  "INTEGRATION",
  "LIB",
] as const

export type ComponentType = (typeof COMPONENT_TYPES)[number]

export const STATUS_VALUES = ["STABLE", "BETA", "DEPRECATED", "DISABLED"] as const
export type ComponentStatus = (typeof STATUS_VALUES)[number]

export const CRITICALITY_VALUES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const
export type ComponentCriticality = (typeof CRITICALITY_VALUES)[number]

export const DEPENDENCY_TYPES = ["HARD", "SOFT", "DATA", "SECURITY"] as const
export type DependencyType = (typeof DEPENDENCY_TYPES)[number]

export interface ComponentDependency {
  componentId: string
  type: DependencyType
}

/**
 * Health check configuration for runtime monitoring.
 * At least one of endpoint or command must be provided.
 */
export interface HealthCheck {
  /** HTTP path for health check, e.g., "/health" */
  endpoint?: string
  /** Shell command for health check, e.g., "pg_isready" */
  command?: string
  /** Check interval, e.g., "30s" */
  interval?: string
}

/**
 * Service Level Objectives for monitoring and alerting.
 * At least one metric must be provided.
 */
export interface SLO {
  /** Availability target, e.g., "99.9%" */
  availability?: string
  /** 50th percentile latency, e.g., "100ms" */
  latencyP50?: string
  /** 99th percentile latency, e.g., "500ms" */
  latencyP99?: string
  /** Error budget, e.g., "0.1%" */
  errorBudget?: string
}

export interface SystemComponent {
  /** Stable identifier. Pattern: {type}-{name-kebab}. NEVER changes after creation. */
  componentId: string

  /** Component type from taxonomy */
  type: ComponentType

  /** Human-readable name. Can change via rename. */
  name: string

  /** Current lifecycle status */
  status: ComponentStatus

  /** Operational criticality for incident response */
  criticality: ComponentCriticality

  /**
   * Owner identifier.
   * Format: "team:<slug>" (required for CRITICAL/HIGH)
   * null only allowed for MEDIUM/LOW.
   */
  owner: string | null

  /** Link to documentation. null = undocumented (metadata gap) */
  docsRef: string | null

  /** Primary code location. null = no single location */
  codeRef: string | null

  /**
   * Additional code locations beyond codeRef for multi-file components.
   * Use for components that span multiple directories (e.g., a library
   * with src/lib/foo and src/app/foo). If provided, must be non-empty.
   */
  codeRefs?: string[]

  /** Components this depends on */
  dependencies: ComponentDependency[]

  /**
   * Components that depend on this one.
   * Required for STORE and INTEGRATION types.
   */
  dependents?: string[]

  /** Alternative IDs for renamed components */
  aliases?: string[]

  /** Critical paths this component participates in */
  criticalPaths?: string[]

  /**
   * Internal component flag.
   * Only valid for type === "LIB".
   *
   * internal=true: Shared utility, helper, non-contract code.
   *   - Still must be declared (prevents shadow systems)
   *   - Relaxed docsRef requirements
   *   - Not user-facing
   *
   * internal=false (default): Real platform boundary.
   *   - Full enforcement applies
   */
  internal?: boolean

  /** Free-form metadata for type-specific info */
  metadata?: Record<string, unknown>

  // Operational metadata for runtime monitoring

  /**
   * Health check configuration.
   * If provided, at least endpoint or command must be specified.
   */
  healthCheck?: HealthCheck

  /**
   * Service Level Objectives.
   * If provided, at least one metric must be specified.
   */
  slo?: SLO

  /** Alert channel for incidents, e.g., "#ops-critical" */
  alertChannel?: string

  /** Path to runbook documentation, e.g., "docs/runbooks/auth.md" */
  runbook?: string
}

/**
 * Critical Path definition.
 * A critical path is an end-to-end flow that must work for legal/money/compliance.
 */
export interface CriticalPath {
  /** Stable path identifier */
  pathId: string

  /** Human-readable name */
  name: string

  /** Ordered list of component IDs in the path */
  components: string[]

  /** Why this path is critical */
  reason: string

  /** SLO target (placeholder for v1) */
  sloTarget?: string
}

/**
 * Observed component from harvester.
 * This is what the code scan produces.
 */
export interface ObservedComponent {
  componentId: string
  type: ComponentType
  name: string
  observedAt: string[]
  discoveryMethod: "directory-exists" | "config-reference" | "route-scan" | "compose-service" | "cron-route" | "code-reference" | "env-usage"
  metadata?: Record<string, unknown>
}

/**
 * Drift entry from comparison.
 */
export interface DriftEntry {
  componentId: string
  type: ComponentType
  driftType: "OBSERVED_NOT_DECLARED" | "DECLARED_NOT_OBSERVED" | "METADATA_GAP" | "CODEREF_INVALID"
  risk: ComponentCriticality
  reason?: string
  observedAt?: string[]
  declaredSource?: string
  gaps?: ("NO_OWNER" | "NO_DOCS" | "NO_CODE_REF" | "NO_DEPENDENCIES")[]
}

/**
 * Enforcement rule for CI gates.
 */
export interface EnforcementRule {
  /** Component types this rule applies to */
  types: ComponentType[]

  /** Criticality levels to enforce */
  criticalities: ComponentCriticality[]

  /** What to check */
  check: "MUST_BE_DECLARED" | "MUST_HAVE_OWNER" | "MUST_HAVE_DOCS"

  /** Whether to fail CI or just warn */
  action: "FAIL" | "WARN"

  /** Human-readable description */
  description: string
}

/**
 * Default enforcement rules.
 * These are the governance gates.
 */
export const DEFAULT_ENFORCEMENT_RULES: EnforcementRule[] = [
  // ROUTE_GROUP enforcement (all)
  {
    types: ["ROUTE_GROUP"],
    criticalities: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
    check: "MUST_BE_DECLARED",
    action: "FAIL",
    description: "All API route groups must be declared in registry",
  },
  // JOB enforcement (all)
  {
    types: ["JOB"],
    criticalities: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
    check: "MUST_BE_DECLARED",
    action: "FAIL",
    description: "All cron jobs must be declared in registry",
  },
  // QUEUE enforcement (all)
  {
    types: ["QUEUE"],
    criticalities: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
    check: "MUST_BE_DECLARED",
    action: "FAIL",
    description: "All queues must be declared in registry",
  },
  // WORKER enforcement
  {
    types: ["WORKER"],
    criticalities: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
    check: "MUST_BE_DECLARED",
    action: "FAIL",
    description: "All workers must be declared in registry",
  },
  // Owner requirements for CRITICAL
  {
    types: ["UI", "MODULE", "ROUTE_GROUP", "WORKER", "JOB", "QUEUE", "STORE", "INTEGRATION", "LIB"],
    criticalities: ["CRITICAL"],
    check: "MUST_HAVE_OWNER",
    action: "FAIL",
    description: "CRITICAL components must have an assigned owner",
  },
  // Owner requirements for HIGH (warning for now)
  {
    types: ["UI", "MODULE", "ROUTE_GROUP", "WORKER", "JOB", "QUEUE", "STORE", "INTEGRATION", "LIB"],
    criticalities: ["HIGH"],
    check: "MUST_HAVE_OWNER",
    action: "WARN",
    description: "HIGH criticality components should have an assigned owner",
  },
]

/**
 * Critical route groups that must be enforced immediately.
 */
export const CRITICAL_ROUTE_GROUPS = [
  "route-group-auth",
  "route-group-billing",
  "route-group-webauthn",
  "route-group-e-invoices",
  "route-group-invoices",
  "route-group-pausalni",
  "route-group-cron",
]

/**
 * Critical jobs that must be enforced immediately.
 */
export const CRITICAL_JOBS = [
  "job-fiscal-processor",
  "job-fiscal-retry",
  "job-certificate-check",
  "job-bank-sync",
]

/**
 * Critical queues that must be enforced immediately.
 */
export const CRITICAL_QUEUES = [
  "queue-release",
  "queue-deadletter",
  "queue-sentinel",
  "queue-extract",
  "queue-compose",
]

// =============================================================================
// OPERATIONAL METADATA VALIDATION
// =============================================================================

export interface OperationalMetadataValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a HealthCheck object.
 * If healthCheck is provided, at least endpoint or command must be specified.
 */
export function validateHealthCheck(
  healthCheck: HealthCheck | undefined
): OperationalMetadataValidationResult {
  if (!healthCheck) {
    return { valid: true, errors: [] }
  }

  const errors: string[] = []

  // At least endpoint or command must be provided
  if (!healthCheck.endpoint && !healthCheck.command) {
    errors.push("healthCheck must have at least endpoint or command specified")
  }

  // If endpoint is provided, it must be non-empty
  if (healthCheck.endpoint !== undefined && healthCheck.endpoint.trim() === "") {
    errors.push("healthCheck.endpoint must be non-empty if provided")
  }

  // If command is provided, it must be non-empty
  if (healthCheck.command !== undefined && healthCheck.command.trim() === "") {
    errors.push("healthCheck.command must be non-empty if provided")
  }

  // If interval is provided, it must be non-empty
  if (healthCheck.interval !== undefined && healthCheck.interval.trim() === "") {
    errors.push("healthCheck.interval must be non-empty if provided")
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate an SLO object.
 * If slo is provided, at least one metric must be specified.
 */
export function validateSLO(slo: SLO | undefined): OperationalMetadataValidationResult {
  if (!slo) {
    return { valid: true, errors: [] }
  }

  const errors: string[] = []

  // At least one metric must be provided
  const hasMetric =
    slo.availability !== undefined ||
    slo.latencyP50 !== undefined ||
    slo.latencyP99 !== undefined ||
    slo.errorBudget !== undefined

  if (!hasMetric) {
    errors.push("slo must have at least one metric specified")
  }

  // If provided, metrics must be non-empty strings
  if (slo.availability !== undefined && slo.availability.trim() === "") {
    errors.push("slo.availability must be non-empty if provided")
  }
  if (slo.latencyP50 !== undefined && slo.latencyP50.trim() === "") {
    errors.push("slo.latencyP50 must be non-empty if provided")
  }
  if (slo.latencyP99 !== undefined && slo.latencyP99.trim() === "") {
    errors.push("slo.latencyP99 must be non-empty if provided")
  }
  if (slo.errorBudget !== undefined && slo.errorBudget.trim() === "") {
    errors.push("slo.errorBudget must be non-empty if provided")
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate alertChannel field.
 * If provided, must be a non-empty string.
 */
export function validateAlertChannel(
  alertChannel: string | undefined
): OperationalMetadataValidationResult {
  if (alertChannel === undefined) {
    return { valid: true, errors: [] }
  }

  if (alertChannel.trim() === "") {
    return { valid: false, errors: ["alertChannel must be non-empty if provided"] }
  }

  return { valid: true, errors: [] }
}

/**
 * Validate runbook field.
 * If provided, must be a non-empty string.
 */
export function validateRunbook(runbook: string | undefined): OperationalMetadataValidationResult {
  if (runbook === undefined) {
    return { valid: true, errors: [] }
  }

  if (runbook.trim() === "") {
    return { valid: false, errors: ["runbook must be non-empty if provided"] }
  }

  return { valid: true, errors: [] }
}

/**
 * Validate all operational metadata fields on a component.
 */
export function validateOperationalMetadata(
  component: Pick<SystemComponent, "healthCheck" | "slo" | "alertChannel" | "runbook">
): OperationalMetadataValidationResult {
  const allErrors: string[] = []

  const healthCheckResult = validateHealthCheck(component.healthCheck)
  allErrors.push(...healthCheckResult.errors)

  const sloResult = validateSLO(component.slo)
  allErrors.push(...sloResult.errors)

  const alertChannelResult = validateAlertChannel(component.alertChannel)
  allErrors.push(...alertChannelResult.errors)

  const runbookResult = validateRunbook(component.runbook)
  allErrors.push(...runbookResult.errors)

  return { valid: allErrors.length === 0, errors: allErrors }
}
