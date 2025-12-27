// src/lib/assistant/reasoning/decision-coverage.ts
import {
  getTopicDimensions,
  isConditionallyRequired,
  type DimensionRequirement,
  type TopicDimensions,
} from "./topic-dimensions"

/**
 * Resolved dimension with source tracking
 */
export interface ResolvedDimension {
  dimension: string
  value: string
  source: "query" | "profile" | "default"
  confidence: number
}

/**
 * Unresolved dimension info
 */
export interface UnresolvedDimension {
  dimension: string
  required: boolean
  possibleValues?: string[]
}

/**
 * Branch for conditional answers
 */
export interface ConditionalBranch {
  condition: string
  dimensionValue: string
  conceptId?: string
  resultingRule?: string
}

/**
 * Terminal outcome types
 */
export type TerminalOutcome = "ANSWER" | "CONDITIONAL_ANSWER" | "REFUSAL"

/**
 * Result of decision coverage calculation
 */
export interface DecisionCoverageResult {
  topic: string
  requiredScore: number // 0-1, must be 1.0 for answer
  totalScore: number // 0-1, including optional
  resolved: ResolvedDimension[]
  unresolved: UnresolvedDimension[]
  terminalOutcome: TerminalOutcome
  branches?: ConditionalBranch[]
}

/**
 * Apply default values based on source
 */
export function applyDefaults(
  dimensions: DimensionRequirement[],
  provided: Record<string, string>
): Record<string, string> {
  const result = { ...provided }

  for (const dim of dimensions) {
    if (!(dim.dimension in result) && dim.defaultValue) {
      // Apply default based on source
      switch (dim.defaultSource) {
        case "temporal":
          if (dim.defaultValue === "today") {
            result[dim.dimension] = new Date().toISOString().split("T")[0]
          } else if (dim.defaultValue === "current-year") {
            result[dim.dimension] = new Date().getFullYear().toString()
          } else {
            result[dim.dimension] = dim.defaultValue
          }
          break
        case "jurisdiction":
          result[dim.dimension] = dim.defaultValue // e.g., "HR"
          break
        case "profile":
          // Would come from user profile - skip for now
          break
        default:
          result[dim.dimension] = dim.defaultValue
      }
    }
  }

  return result
}

/**
 * Generate conditional branches for unresolved optional dimensions
 */
export function generateBranches(unresolved: UnresolvedDimension[]): ConditionalBranch[] {
  const branches: ConditionalBranch[] = []

  for (const dim of unresolved) {
    if (!dim.required && dim.possibleValues) {
      for (const value of dim.possibleValues) {
        branches.push({
          condition: `If ${dim.dimension} is ${value}`,
          dimensionValue: value,
        })
      }
    }
  }

  return branches
}

/**
 * Calculate decision coverage for a topic
 */
export function calculateDecisionCoverage(
  topic: string,
  providedDimensions: Record<string, string>,
  userProfile?: Record<string, string>
): DecisionCoverageResult {
  const topicConfig = getTopicDimensions(topic)

  if (!topicConfig) {
    // Unknown topic - return minimal coverage
    return {
      topic,
      requiredScore: 0,
      totalScore: 0,
      resolved: [],
      unresolved: [],
      terminalOutcome: "REFUSAL",
    }
  }

  // Apply defaults
  const dimensionsWithDefaults = applyDefaults(topicConfig.dimensions, providedDimensions)

  // Merge with user profile if available
  const allDimensions = {
    ...userProfile,
    ...dimensionsWithDefaults,
  }

  const resolved: ResolvedDimension[] = []
  const unresolved: UnresolvedDimension[] = []

  let requiredCount = 0
  let requiredResolved = 0
  let totalDimensions = 0
  let totalResolved = 0

  // Evaluate each dimension
  for (const dim of topicConfig.dimensions) {
    const isRequired = isConditionallyRequired(dim, allDimensions)
    const value = allDimensions[dim.dimension]
    const hasValue = value !== undefined && value !== ""

    // Check if this is a conditionally required dimension that doesn't apply
    const isConditionalDimension = typeof dim.required === "object"
    const conditionMet = isConditionalDimension
      ? allDimensions[(dim.required as { dependsOn: string; value: string }).dependsOn] ===
        (dim.required as { dependsOn: string; value: string }).value
      : true

    // Only count dimension if it's always required/optional OR its condition is met
    if (!isConditionalDimension || conditionMet) {
      totalDimensions++

      if (isRequired) {
        requiredCount++
      }

      if (hasValue) {
        totalResolved++
        if (isRequired) {
          requiredResolved++
        }

        // Determine source
        let source: "query" | "profile" | "default" = "query"
        if (dim.defaultValue && !(dim.dimension in providedDimensions)) {
          source = "default"
        } else if (userProfile && dim.dimension in userProfile) {
          source = "profile"
        }

        resolved.push({
          dimension: dim.dimension,
          value,
          source,
          confidence: source === "query" ? 0.95 : source === "profile" ? 0.85 : 0.7,
        })
      } else {
        unresolved.push({
          dimension: dim.dimension,
          required: isRequired,
          possibleValues: dim.possibleValues,
        })
      }
    }
    // If condition is not met, this dimension is not applicable and is skipped entirely
  }

  // Calculate scores
  const requiredScore = requiredCount > 0 ? requiredResolved / requiredCount : 1
  const totalScore = totalDimensions > 0 ? totalResolved / totalDimensions : 0

  // Determine terminal outcome
  let terminalOutcome: TerminalOutcome

  if (requiredScore < 1) {
    terminalOutcome = "REFUSAL"
  } else if (totalScore < 1) {
    terminalOutcome = "CONDITIONAL_ANSWER"
  } else {
    terminalOutcome = "ANSWER"
  }

  // Generate branches for conditional answers
  const branches =
    terminalOutcome === "CONDITIONAL_ANSWER" ? generateBranches(unresolved) : undefined

  return {
    topic,
    requiredScore,
    totalScore,
    resolved,
    unresolved,
    terminalOutcome,
    branches,
  }
}

/**
 * Infer topic from query classification
 */
export function inferTopicFromIntent(
  intent: string,
  entities: { subjects: string[]; products: string[] }
): string | undefined {
  // Map intents and entities to topics
  if (intent === "LOGIC") {
    if (entities.products.some((p) => /pdv|vat/i.test(p))) {
      return "vat-rate"
    }
    if (entities.subjects.some((s) => /paušal/i.test(s))) {
      return "pausalni"
    }
  }

  if (intent === "PROCESS") {
    if (entities.subjects.some((s) => /registracija|otvoriti/i.test(s))) {
      return "registration"
    }
  }

  // Add more topic inference rules as needed
  return undefined
}
