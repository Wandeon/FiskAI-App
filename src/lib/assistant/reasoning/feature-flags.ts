// src/lib/assistant/reasoning/feature-flags.ts
//
// Feature rollout system with multiple targeting mechanisms.
// Supports: percentage-based, legal form, subscription tier, time-based,
// cohort-based rollouts, and kill switch capability.
//
// @see /src/lib/config/features.ts for global configuration
// @see GitHub issue #293 for rollout requirements

import { getReasoningConfig } from "@/lib/config/features"

export type ReasoningMode = "off" | "shadow" | "live"

/**
 * Supported legal forms for Croatian businesses.
 */
export type LegalForm = "pausalni" | "doo" | "jdoo" | "dd" | "obrt" | "other"

/**
 * Subscription plan tiers.
 */
export type SubscriptionPlan = "pausalni" | "starter" | "professional" | "enterprise"

/**
 * User context for rollout evaluation.
 * Contains all attributes that can be used for targeting.
 */
export interface RolloutUserContext {
  userId: string
  betaOptIn?: boolean
  legalForm?: LegalForm | string | null
  subscriptionPlan?: SubscriptionPlan | string | null
  createdAt?: Date | string | null
  country?: string | null
  city?: string | null
}

/**
 * Rollout rule types for different targeting mechanisms.
 */
export type RolloutRuleType =
  | "percentage" // Hash-based percentage rollout
  | "legalForm" // Target specific legal forms
  | "subscriptionPlan" // Target subscription tiers
  | "cohort" // Users created within date range
  | "geo" // Geographic targeting (country/city)
  | "scheduled" // Time-based activation
  | "allowlist" // Explicit user IDs
  | "denylist" // Explicitly excluded user IDs

/**
 * Base rollout rule structure.
 */
export interface RolloutRuleBase {
  type: RolloutRuleType
  enabled: boolean
  priority?: number // Higher priority rules evaluated first
}

/**
 * Percentage-based rollout rule.
 */
export interface PercentageRule extends RolloutRuleBase {
  type: "percentage"
  percentage: number // 0-100
}

/**
 * Legal form targeting rule.
 */
export interface LegalFormRule extends RolloutRuleBase {
  type: "legalForm"
  forms: string[] // e.g., ["pausalni", "doo"]
}

/**
 * Subscription plan targeting rule.
 */
export interface SubscriptionPlanRule extends RolloutRuleBase {
  type: "subscriptionPlan"
  plans: string[] // e.g., ["professional", "enterprise"]
}

/**
 * Cohort-based rollout rule (by account creation date).
 */
export interface CohortRule extends RolloutRuleBase {
  type: "cohort"
  createdAfter?: string // ISO date string
  createdBefore?: string // ISO date string
}

/**
 * Geographic targeting rule.
 */
export interface GeoRule extends RolloutRuleBase {
  type: "geo"
  countries?: string[] // ISO country codes, e.g., ["HR", "SI"]
  cities?: string[] // City names
}

/**
 * Scheduled activation rule.
 */
export interface ScheduledRule extends RolloutRuleBase {
  type: "scheduled"
  activateAt?: string // ISO datetime - feature activates after this time
  deactivateAt?: string // ISO datetime - feature deactivates after this time
}

/**
 * Allowlist rule for explicit user targeting.
 */
export interface AllowlistRule extends RolloutRuleBase {
  type: "allowlist"
  userIds: string[]
}

/**
 * Denylist rule for explicit user exclusion.
 */
export interface DenylistRule extends RolloutRuleBase {
  type: "denylist"
  userIds: string[]
}

/**
 * Union type of all rollout rules.
 */
export type RolloutRule =
  | PercentageRule
  | LegalFormRule
  | SubscriptionPlanRule
  | CohortRule
  | GeoRule
  | ScheduledRule
  | AllowlistRule
  | DenylistRule

/**
 * Complete rollout configuration for a feature.
 */
export interface RolloutConfig {
  featureId: string
  enabled: boolean // Global kill switch
  rules: RolloutRule[]
  defaultBehavior: "allow" | "deny" // When no rules match
}

/**
 * Result of evaluating rollout rules.
 */
export interface RolloutEvaluationResult {
  allowed: boolean
  matchedRule?: RolloutRule
  reason: string
}

// =============================================================================
// Rule Evaluation Functions
// =============================================================================

/**
 * Evaluate a percentage-based rule.
 */
function evaluatePercentageRule(rule: PercentageRule, ctx: RolloutUserContext): boolean {
  if (rule.percentage <= 0) return false
  if (rule.percentage >= 100) return true
  const hash = hashString(ctx.userId)
  return hash % 100 < rule.percentage
}

/**
 * Evaluate a legal form rule.
 */
function evaluateLegalFormRule(rule: LegalFormRule, ctx: RolloutUserContext): boolean {
  if (!ctx.legalForm) return false
  return rule.forms.includes(ctx.legalForm.toLowerCase())
}

/**
 * Evaluate a subscription plan rule.
 */
function evaluateSubscriptionPlanRule(
  rule: SubscriptionPlanRule,
  ctx: RolloutUserContext
): boolean {
  if (!ctx.subscriptionPlan) return false
  return rule.plans.includes(ctx.subscriptionPlan.toLowerCase())
}

/**
 * Evaluate a cohort rule.
 */
function evaluateCohortRule(rule: CohortRule, ctx: RolloutUserContext): boolean {
  if (!ctx.createdAt) return false
  const createdAt = typeof ctx.createdAt === "string" ? new Date(ctx.createdAt) : ctx.createdAt

  if (rule.createdAfter) {
    const afterDate = new Date(rule.createdAfter)
    if (createdAt < afterDate) return false
  }

  if (rule.createdBefore) {
    const beforeDate = new Date(rule.createdBefore)
    if (createdAt > beforeDate) return false
  }

  return true
}

/**
 * Evaluate a geographic rule.
 */
function evaluateGeoRule(rule: GeoRule, ctx: RolloutUserContext): boolean {
  // Check country
  if (rule.countries && rule.countries.length > 0) {
    if (!ctx.country) return false
    if (!rule.countries.includes(ctx.country.toUpperCase())) return false
  }

  // Check city
  if (rule.cities && rule.cities.length > 0) {
    if (!ctx.city) return false
    const normalizedCity = ctx.city.toLowerCase()
    const matchesCity = rule.cities.some((c) => c.toLowerCase() === normalizedCity)
    if (!matchesCity) return false
  }

  return true
}

/**
 * Evaluate a scheduled rule.
 */
function evaluateScheduledRule(rule: ScheduledRule, _ctx: RolloutUserContext): boolean {
  const now = new Date()

  if (rule.activateAt) {
    const activateDate = new Date(rule.activateAt)
    if (now < activateDate) return false
  }

  if (rule.deactivateAt) {
    const deactivateDate = new Date(rule.deactivateAt)
    if (now > deactivateDate) return false
  }

  return true
}

/**
 * Evaluate an allowlist rule.
 */
function evaluateAllowlistRule(rule: AllowlistRule, ctx: RolloutUserContext): boolean {
  return rule.userIds.includes(ctx.userId)
}

/**
 * Evaluate a denylist rule.
 */
function evaluateDenylistRule(rule: DenylistRule, ctx: RolloutUserContext): boolean {
  return rule.userIds.includes(ctx.userId)
}

/**
 * Evaluate a single rule against user context.
 */
function evaluateRule(rule: RolloutRule, ctx: RolloutUserContext): boolean {
  if (!rule.enabled) return false

  switch (rule.type) {
    case "percentage":
      return evaluatePercentageRule(rule, ctx)
    case "legalForm":
      return evaluateLegalFormRule(rule, ctx)
    case "subscriptionPlan":
      return evaluateSubscriptionPlanRule(rule, ctx)
    case "cohort":
      return evaluateCohortRule(rule, ctx)
    case "geo":
      return evaluateGeoRule(rule, ctx)
    case "scheduled":
      return evaluateScheduledRule(rule, ctx)
    case "allowlist":
      return evaluateAllowlistRule(rule, ctx)
    case "denylist":
      return evaluateDenylistRule(rule, ctx)
    default:
      return false
  }
}

/**
 * Evaluate all rollout rules for a feature.
 * Rules are evaluated in priority order (highest first).
 * Denylist rules are checked first regardless of priority.
 */
export function evaluateRollout(
  config: RolloutConfig,
  ctx: RolloutUserContext
): RolloutEvaluationResult {
  // Kill switch check
  if (!config.enabled) {
    return {
      allowed: false,
      reason: "Feature is disabled (kill switch)",
    }
  }

  // Check denylist first (always takes precedence)
  const denylistRules = config.rules.filter(
    (r): r is DenylistRule => r.type === "denylist" && r.enabled
  )
  for (const rule of denylistRules) {
    if (evaluateDenylistRule(rule, ctx)) {
      return {
        allowed: false,
        matchedRule: rule,
        reason: "User is on denylist",
      }
    }
  }

  // Check allowlist (high priority)
  const allowlistRules = config.rules.filter(
    (r): r is AllowlistRule => r.type === "allowlist" && r.enabled
  )
  for (const rule of allowlistRules) {
    if (evaluateAllowlistRule(rule, ctx)) {
      return {
        allowed: true,
        matchedRule: rule,
        reason: "User is on allowlist",
      }
    }
  }

  // Sort remaining rules by priority (higher first)
  const otherRules = config.rules
    .filter((r) => r.type !== "denylist" && r.type !== "allowlist")
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

  // Evaluate rules in priority order
  for (const rule of otherRules) {
    if (evaluateRule(rule, ctx)) {
      return {
        allowed: true,
        matchedRule: rule,
        reason: `Matched ${rule.type} rule`,
      }
    }
  }

  // No rules matched, use default behavior
  return {
    allowed: config.defaultBehavior === "allow",
    reason: `No rules matched, default: ${config.defaultBehavior}`,
  }
}

// =============================================================================
// Default Reasoning Beta Rollout Configuration
// =============================================================================

/**
 * Get the default rollout configuration for reasoning beta.
 * Combines environment-based percentage with extensible rules.
 */
export function getReasoningBetaRolloutConfig(): RolloutConfig {
  const reasoningConfig = getReasoningConfig()

  return {
    featureId: "reasoning-beta",
    enabled: true, // Can be set to false as kill switch
    defaultBehavior: "deny",
    rules: [
      // Percentage-based rollout from environment config
      {
        type: "percentage",
        enabled: true,
        percentage: reasoningConfig.betaPercentage,
        priority: 10,
      },
      // Example: Enterprise users always get beta features
      // Uncomment to enable:
      // {
      //   type: "subscriptionPlan",
      //   enabled: true,
      //   plans: ["enterprise"],
      //   priority: 20,
      // },
    ],
  }
}

// =============================================================================
// Public API (Backward Compatible)
// =============================================================================

/**
 * Check if the Visible Reasoning UX is enabled.
 */
export function isReasoningEnabled(): boolean {
  return getReasoningConfig().enabled
}

/**
 * Get the current reasoning mode.
 * - off: Use legacy pipeline only
 * - shadow: Run both pipelines, legacy serves response, new logs trace
 * - live: Use new reasoning pipeline
 */
export function getReasoningMode(): ReasoningMode {
  return getReasoningConfig().mode
}

/**
 * Check if user is in the reasoning beta cohort.
 * Users can opt-in explicitly OR be selected via rollout rules.
 *
 * @param userId - The user's ID
 * @param userBetaOptIn - Whether the user has explicitly opted into beta
 * @param userContext - Additional user context for advanced targeting
 */
export function isInReasoningBeta(
  userId: string,
  userBetaOptIn?: boolean,
  userContext?: Partial<RolloutUserContext>
): boolean {
  // Explicit opt-in always grants beta access
  if (userBetaOptIn === true) {
    return true
  }

  // Build full context
  const ctx: RolloutUserContext = {
    userId,
    betaOptIn: userBetaOptIn,
    ...userContext,
  }

  // Evaluate against rollout configuration
  const config = getReasoningBetaRolloutConfig()
  const result = evaluateRollout(config, ctx)

  return result.allowed
}

/**
 * Check if user is in beta with detailed evaluation result.
 * Useful for debugging and observability.
 */
export function evaluateReasoningBeta(
  userId: string,
  userBetaOptIn?: boolean,
  userContext?: Partial<RolloutUserContext>
): RolloutEvaluationResult {
  // Explicit opt-in always grants beta access
  if (userBetaOptIn === true) {
    return {
      allowed: true,
      reason: "User explicitly opted into beta",
    }
  }

  const ctx: RolloutUserContext = {
    userId,
    betaOptIn: userBetaOptIn,
    ...userContext,
  }

  const config = getReasoningBetaRolloutConfig()
  return evaluateRollout(config, ctx)
}

/**
 * Get reasoning mode for a specific user.
 * Combines feature flags with per-user beta status and explicit opt-in.
 *
 * @param userId - The user's ID
 * @param userBetaOptIn - Whether the user has explicitly opted into beta
 * @param userContext - Additional user context for advanced targeting
 */
export function getReasoningModeForUser(
  userId?: string,
  userBetaOptIn?: boolean,
  userContext?: Partial<RolloutUserContext>
): ReasoningMode {
  const globalMode = getReasoningMode()

  // Shadow mode always applies globally
  if (globalMode === "shadow") {
    return "shadow"
  }

  // Live mode respects beta cohort or explicit opt-in
  if (globalMode === "live") {
    if (!userId) return "off"
    return isInReasoningBeta(userId, userBetaOptIn, userContext) ? "live" : "off"
  }

  return "off"
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Simple string hash for consistent user bucketing.
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Create a custom rollout configuration.
 * Helper for building rollout configs programmatically.
 */
export function createRolloutConfig(
  featureId: string,
  rules: RolloutRule[],
  options?: {
    enabled?: boolean
    defaultBehavior?: "allow" | "deny"
  }
): RolloutConfig {
  return {
    featureId,
    enabled: options?.enabled ?? true,
    defaultBehavior: options?.defaultBehavior ?? "deny",
    rules,
  }
}

/**
 * Create a percentage rule.
 */
export function percentageRule(percentage: number, priority = 10): PercentageRule {
  return {
    type: "percentage",
    enabled: true,
    percentage,
    priority,
  }
}

/**
 * Create a legal form rule.
 */
export function legalFormRule(forms: string[], priority = 20): LegalFormRule {
  return {
    type: "legalForm",
    enabled: true,
    forms: forms.map((f) => f.toLowerCase()),
    priority,
  }
}

/**
 * Create a subscription plan rule.
 */
export function subscriptionPlanRule(plans: string[], priority = 20): SubscriptionPlanRule {
  return {
    type: "subscriptionPlan",
    enabled: true,
    plans: plans.map((p) => p.toLowerCase()),
    priority,
  }
}

/**
 * Create a cohort rule.
 */
export function cohortRule(
  options: { createdAfter?: string; createdBefore?: string },
  priority = 15
): CohortRule {
  return {
    type: "cohort",
    enabled: true,
    ...options,
    priority,
  }
}

/**
 * Create a geographic rule.
 */
export function geoRule(
  options: { countries?: string[]; cities?: string[] },
  priority = 15
): GeoRule {
  return {
    type: "geo",
    enabled: true,
    countries: options.countries?.map((c) => c.toUpperCase()),
    cities: options.cities,
    priority,
  }
}

/**
 * Create a scheduled rule.
 */
export function scheduledRule(
  options: { activateAt?: string; deactivateAt?: string },
  priority = 25
): ScheduledRule {
  return {
    type: "scheduled",
    enabled: true,
    ...options,
    priority,
  }
}

/**
 * Create an allowlist rule.
 */
export function allowlistRule(userIds: string[]): AllowlistRule {
  return {
    type: "allowlist",
    enabled: true,
    userIds,
  }
}

/**
 * Create a denylist rule.
 */
export function denylistRule(userIds: string[]): DenylistRule {
  return {
    type: "denylist",
    enabled: true,
    userIds,
  }
}
