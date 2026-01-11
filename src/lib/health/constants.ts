// src/lib/health/constants.ts
/**
 * Health Check Constants
 *
 * Centralized definitions for health endpoints and failure reasons.
 * All health checks, deploy configs, and monitoring should reference these.
 *
 * DO NOT hardcode health URLs elsewhere - import from here.
 */

/**
 * Health endpoint paths.
 * Use these constants in:
 * - Dockerfile HEALTHCHECK
 * - Kubernetes probe configs
 * - Load balancer health checks
 * - Monitoring dashboards
 */
export const HEALTH_ENDPOINTS = {
  /**
   * Liveness probe - is the process alive?
   * - Always returns 200 if process can handle requests
   * - No external dependencies (fast, ~10ms)
   * - Use for: container restart decisions
   */
  LIVENESS: "/api/health",

  /**
   * Readiness probe - is the app ready for traffic?
   * - Checks DB connectivity, memory, feature contracts
   * - Returns 503 if not ready
   * - Use for: traffic routing decisions
   */
  READINESS: "/api/health/ready",

  /**
   * Content pipelines health - are background workers healthy?
   * - Checks regulatory truth pipeline status
   * - Use for: operational monitoring
   */
  CONTENT_PIPELINES: "/api/health/content-pipelines",
} as const

/**
 * Readiness failure reasons.
 * Machine-readable codes for why readiness failed.
 */
export const READINESS_FAILURE_REASONS = {
  /** Database is unreachable or too slow */
  DATABASE_UNAVAILABLE: "database_unavailable",

  /** Memory usage exceeds safe threshold */
  MEMORY_CRITICAL: "memory_critical",

  /** App still initializing (uptime < 5s) */
  INITIALIZING: "initializing",

  /** Type A feature contract violated - required tables missing */
  MISSING_FEATURE_TABLES: "missing_feature_tables",
} as const

export type ReadinessFailureReason =
  (typeof READINESS_FAILURE_REASONS)[keyof typeof READINESS_FAILURE_REASONS]

/**
 * Structured readiness failure payload.
 * Returned in 503 responses for actionable alerting.
 */
export interface ReadinessFailurePayload {
  status: "not_ready"
  reason: ReadinessFailureReason
  timestamp: string
  version: string
  uptime: number

  /** Environment: production, staging, development */
  env: string

  /** For missing_feature_tables failures */
  failingFeatures?: Array<{
    featureId: string
    name: string
    missingTables: string[]
  }>

  /** Human-readable message */
  message: string

  /** Suggested action to resolve */
  action: string
}
