/**
 * Unified Feature Configuration
 *
 * Single source of truth for all feature flags, thresholds, and module settings.
 * Consolidates configuration previously scattered across:
 * - Environment variables (.env)
 * - Database (Company.featureFlags, Company.entitlements)
 * - Code constants (definitions.ts, types.ts)
 *
 * Architecture:
 * - Zod schemas for runtime validation
 * - Type-safe access with defaults
 * - Clear separation: global (env) vs tenant (db) config
 * - Startup validation logs misconfiguration
 *
 * @see https://github.com/Wandeon/FiskAI/issues/312
 */

import { z } from "zod"

// =============================================================================
// Schema Definitions
// =============================================================================

/**
 * Reasoning UX feature configuration
 */
export const ReasoningConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["off", "shadow", "live"]).default("off"),
  betaPercentage: z.number().min(0).max(100).default(0),
})

/**
 * Article Agent thresholds
 */
export const ArticleAgentConfigSchema = z.object({
  passThreshold: z.number().min(0).max(1).default(0.8),
  failThreshold: z.number().min(0).max(1).default(0.5),
  maxIterations: z.number().min(1).max(10).default(3),
  jobAutoApprove: z.number().min(0).max(1).default(0.85),
  minSupportingClaims: z.number().min(0).default(1),
  topKChunks: z.number().min(1).default(5),
})

/**
 * Watchdog health monitoring thresholds
 */
export const WatchdogConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timezone: z.string().default("Europe/Zagreb"),
  // Source staleness
  staleSourceWarningDays: z.number().default(7),
  staleSourceCriticalDays: z.number().default(14),
  // Failure rates
  failureRateWarning: z.number().min(0).max(1).default(0.3),
  failureRateCritical: z.number().min(0).max(1).default(0.5),
  // Confidence thresholds
  confidenceWarning: z.number().min(0).max(1).default(0.85),
  confidenceCritical: z.number().min(0).max(1).default(0.75),
  // Rejection rates
  rejectionRateWarning: z.number().min(0).max(1).default(0.4),
  rejectionRateCritical: z.number().min(0).max(1).default(0.6),
  // Phase duration multipliers
  phaseDurationWarningMultiplier: z.number().default(2),
  phaseDurationCriticalMultiplier: z.number().default(3),
  // Drainer stall detection
  drainerStallWarningMinutes: z.number().default(15),
  drainerStallCriticalMinutes: z.number().default(30),
  // Queue monitoring
  queueBacklogWarning: z.number().default(50),
  queueBacklogCritical: z.number().default(100),
  dlqWarning: z.number().default(10),
  dlqCritical: z.number().default(50),
})

/**
 * Scheduler/cron timing configuration
 */
export const SchedulerConfigSchema = z.object({
  scoutStartHour: z.number().min(0).max(23).default(6),
  scoutTimeoutMinutes: z.number().default(30),
  scrapeTimeoutHour: z.number().min(0).max(23).default(8),
})

/**
 * Fiscal/demo mode configuration
 */
export const FiscalConfigSchema = z.object({
  demoMode: z.boolean().default(false),
})

/**
 * Global feature configuration (from environment)
 */
export const GlobalFeatureConfigSchema = z.object({
  reasoning: ReasoningConfigSchema,
  articleAgent: ArticleAgentConfigSchema,
  watchdog: WatchdogConfigSchema,
  scheduler: SchedulerConfigSchema,
  fiscal: FiscalConfigSchema,
})

/**
 * Per-tenant feature flags (from Company.featureFlags)
 */
export const TenantFeatureFlagsSchema = z.record(z.string(), z.boolean()).default({})

// =============================================================================
// Type Exports
// =============================================================================

export type ReasoningConfig = z.infer<typeof ReasoningConfigSchema>
export type ArticleAgentConfig = z.infer<typeof ArticleAgentConfigSchema>
export type WatchdogConfig = z.infer<typeof WatchdogConfigSchema>
export type SchedulerConfig = z.infer<typeof SchedulerConfigSchema>
export type FiscalConfig = z.infer<typeof FiscalConfigSchema>
export type GlobalFeatureConfig = z.infer<typeof GlobalFeatureConfigSchema>
export type TenantFeatureFlags = z.infer<typeof TenantFeatureFlagsSchema>

// =============================================================================
// Environment Parsing
// =============================================================================

/**
 * Parse global feature configuration from environment variables.
 * Returns validated config with defaults for missing values.
 */
export function parseGlobalConfig(): GlobalFeatureConfig {
  const rawConfig = {
    reasoning: {
      enabled: process.env.REASONING_UX_ENABLED === "true",
      mode: process.env.REASONING_MODE || "off",
      betaPercentage: parseInt(process.env.REASONING_BETA_PERCENTAGE || "0", 10),
    },
    articleAgent: {
      passThreshold: parseFloat(process.env.ARTICLE_AGENT_PASS_THRESHOLD || "0.8"),
      failThreshold: parseFloat(process.env.ARTICLE_AGENT_FAIL_THRESHOLD || "0.5"),
      maxIterations: parseInt(process.env.ARTICLE_AGENT_MAX_ITERATIONS || "3", 10),
      jobAutoApprove: 0.85,
      minSupportingClaims: 1,
      topKChunks: 5,
    },
    watchdog: {
      enabled: process.env.WATCHDOG_ENABLED !== "false",
      timezone: process.env.WATCHDOG_TIMEZONE || "Europe/Zagreb",
      staleSourceWarningDays: parseInt(process.env.STALE_SOURCE_WARNING_DAYS || "7", 10),
      staleSourceCriticalDays: parseInt(process.env.STALE_SOURCE_CRITICAL_DAYS || "14", 10),
      failureRateWarning: parseFloat(process.env.FAILURE_RATE_WARNING || "0.3"),
      failureRateCritical: parseFloat(process.env.FAILURE_RATE_CRITICAL || "0.5"),
      confidenceWarning: parseFloat(process.env.CONFIDENCE_WARNING || "0.85"),
      confidenceCritical: parseFloat(process.env.CONFIDENCE_CRITICAL || "0.75"),
      rejectionRateWarning: parseFloat(process.env.REJECTION_RATE_WARNING || "0.4"),
      rejectionRateCritical: parseFloat(process.env.REJECTION_RATE_CRITICAL || "0.6"),
      phaseDurationWarningMultiplier: 2,
      phaseDurationCriticalMultiplier: 3,
      drainerStallWarningMinutes: 15,
      drainerStallCriticalMinutes: 30,
      queueBacklogWarning: 50,
      queueBacklogCritical: 100,
      dlqWarning: 10,
      dlqCritical: 50,
    },
    scheduler: {
      scoutStartHour: parseInt(process.env.SCOUT_START_HOUR || "6", 10),
      scoutTimeoutMinutes: parseInt(process.env.SCOUT_TIMEOUT_MINUTES || "30", 10),
      scrapeTimeoutHour: parseInt(process.env.SCRAPE_TIMEOUT_HOUR || "8", 10),
    },
    fiscal: {
      demoMode: process.env.FISCAL_DEMO_MODE === "true",
    },
  }

  const result = GlobalFeatureConfigSchema.safeParse(rawConfig)
  if (!result.success) {
    console.error("[feature-config] Invalid configuration:", result.error.format())
    // Return defaults on parse failure - provide full default structure
    return {
      reasoning: { enabled: false, mode: "off", betaPercentage: 0 },
      articleAgent: {
        passThreshold: 0.8,
        failThreshold: 0.5,
        maxIterations: 3,
        jobAutoApprove: 0.85,
        minSupportingClaims: 1,
        topKChunks: 5,
      },
      watchdog: {
        enabled: true,
        timezone: "Europe/Zagreb",
        staleSourceWarningDays: 7,
        staleSourceCriticalDays: 14,
        failureRateWarning: 0.3,
        failureRateCritical: 0.5,
        confidenceWarning: 0.85,
        confidenceCritical: 0.75,
        rejectionRateWarning: 0.4,
        rejectionRateCritical: 0.6,
        phaseDurationWarningMultiplier: 2,
        phaseDurationCriticalMultiplier: 3,
        drainerStallWarningMinutes: 15,
        drainerStallCriticalMinutes: 30,
        queueBacklogWarning: 50,
        queueBacklogCritical: 100,
        dlqWarning: 10,
        dlqCritical: 50,
      },
      scheduler: {
        scoutStartHour: 6,
        scoutTimeoutMinutes: 30,
        scrapeTimeoutHour: 8,
      },
      fiscal: { demoMode: false },
    }
  }

  return result.data
}

/**
 * Parse tenant feature flags from Company.featureFlags JSON.
 */
export function parseTenantFlags(flags: unknown): TenantFeatureFlags {
  const result = TenantFeatureFlagsSchema.safeParse(flags)
  return result.success ? result.data : {}
}

// =============================================================================
// Singleton Config Instance
// =============================================================================

let _globalConfig: GlobalFeatureConfig | null = null

/**
 * Get the global feature configuration (cached singleton).
 * Call this instead of parsing env vars directly.
 */
export function getGlobalConfig(): GlobalFeatureConfig {
  if (!_globalConfig) {
    _globalConfig = parseGlobalConfig()
  }
  return _globalConfig
}

/**
 * Reset the cached config (for testing).
 */
export function resetGlobalConfig(): void {
  _globalConfig = null
}

// =============================================================================
// Convenience Accessors
// =============================================================================

/**
 * Get reasoning configuration.
 */
export function getReasoningConfig(): ReasoningConfig {
  return getGlobalConfig().reasoning
}

/**
 * Get article agent configuration.
 */
export function getArticleAgentConfig(): ArticleAgentConfig {
  return getGlobalConfig().articleAgent
}

/**
 * Get watchdog configuration.
 */
export function getWatchdogConfig(): WatchdogConfig {
  return getGlobalConfig().watchdog
}

/**
 * Get scheduler configuration.
 */
export function getSchedulerConfig(): SchedulerConfig {
  return getGlobalConfig().scheduler
}

/**
 * Get fiscal configuration.
 */
export function getFiscalConfig(): FiscalConfig {
  return getGlobalConfig().fiscal
}

// =============================================================================
// Startup Validation
// =============================================================================

/**
 * Validate configuration on startup and log any issues.
 * Call this in server startup to catch misconfiguration early.
 */
export function validateConfigOnStartup(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = []
  const config = getGlobalConfig()

  // Reasoning mode validation
  if (config.reasoning.mode === "live" && config.reasoning.betaPercentage === 0) {
    warnings.push("Reasoning mode is 'live' but beta percentage is 0 - no users will see reasoning")
  }

  if (config.reasoning.mode === "shadow" && !config.reasoning.enabled) {
    warnings.push("Reasoning mode is 'shadow' but REASONING_UX_ENABLED is false - inconsistent config")
  }

  // Threshold validation
  if (config.articleAgent.failThreshold >= config.articleAgent.passThreshold) {
    warnings.push("Article agent fail threshold >= pass threshold - paragraphs cannot pass verification")
  }

  if (config.watchdog.confidenceCritical >= config.watchdog.confidenceWarning) {
    warnings.push("Watchdog confidence critical >= warning - alerts will skip warning level")
  }

  if (config.watchdog.failureRateCritical <= config.watchdog.failureRateWarning) {
    warnings.push("Watchdog failure rate critical <= warning - alerts will skip warning level")
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn("[feature-config] Configuration warnings:")
    warnings.forEach((w) => console.warn(`  - ${w}`))
  }

  return { valid: warnings.length === 0, warnings }
}

// =============================================================================
// Configuration Documentation
// =============================================================================

/**
 * Get all configuration options with their current values and descriptions.
 * Useful for admin UI or debugging.
 */
export function getConfigDocumentation(): Array<{
  category: string
  key: string
  value: unknown
  envVar: string | null
  description: string
}> {
  const config = getGlobalConfig()

  return [
    // Reasoning
    {
      category: "Reasoning",
      key: "reasoning.enabled",
      value: config.reasoning.enabled,
      envVar: "REASONING_UX_ENABLED",
      description: "Enable/disable reasoning UX globally",
    },
    {
      category: "Reasoning",
      key: "reasoning.mode",
      value: config.reasoning.mode,
      envVar: "REASONING_MODE",
      description: "Reasoning pipeline mode: off | shadow | live",
    },
    {
      category: "Reasoning",
      key: "reasoning.betaPercentage",
      value: config.reasoning.betaPercentage,
      envVar: "REASONING_BETA_PERCENTAGE",
      description: "Percentage of users in reasoning beta (0-100)",
    },

    // Article Agent
    {
      category: "Article Agent",
      key: "articleAgent.passThreshold",
      value: config.articleAgent.passThreshold,
      envVar: "ARTICLE_AGENT_PASS_THRESHOLD",
      description: "Confidence threshold for paragraph to pass verification",
    },
    {
      category: "Article Agent",
      key: "articleAgent.failThreshold",
      value: config.articleAgent.failThreshold,
      envVar: "ARTICLE_AGENT_FAIL_THRESHOLD",
      description: "Confidence threshold below which paragraph fails",
    },
    {
      category: "Article Agent",
      key: "articleAgent.maxIterations",
      value: config.articleAgent.maxIterations,
      envVar: "ARTICLE_AGENT_MAX_ITERATIONS",
      description: "Maximum rewrite iterations before manual review",
    },

    // Watchdog
    {
      category: "Watchdog",
      key: "watchdog.enabled",
      value: config.watchdog.enabled,
      envVar: "WATCHDOG_ENABLED",
      description: "Enable/disable watchdog health monitoring",
    },
    {
      category: "Watchdog",
      key: "watchdog.staleSourceWarningDays",
      value: config.watchdog.staleSourceWarningDays,
      envVar: "STALE_SOURCE_WARNING_DAYS",
      description: "Days before source staleness warning",
    },
    {
      category: "Watchdog",
      key: "watchdog.staleSourceCriticalDays",
      value: config.watchdog.staleSourceCriticalDays,
      envVar: "STALE_SOURCE_CRITICAL_DAYS",
      description: "Days before source staleness critical alert",
    },

    // Fiscal
    {
      category: "Fiscal",
      key: "fiscal.demoMode",
      value: config.fiscal.demoMode,
      envVar: "FISCAL_DEMO_MODE",
      description: "Enable demo mode to bypass real FINA API",
    },
  ]
}
