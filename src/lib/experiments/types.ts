/**
 * A/B Testing & Experimentation Types
 *
 * Complete type definitions for the experimentation framework.
 * @see GitHub issue #292
 */

import type {
  Experiment,
  ExperimentVariant,
  ExperimentAssignment,
  ExperimentEvent,
  ExperimentStatus,
} from "@prisma/client"

// Re-export Prisma types
export type {
  Experiment,
  ExperimentVariant,
  ExperimentAssignment,
  ExperimentEvent,
  ExperimentStatus,
}

/**
 * Experiment with all relations
 */
export type ExperimentWithRelations = Experiment & {
  variants: ExperimentVariant[]
  assignments?: ExperimentAssignment[]
  events?: ExperimentEvent[]
}

/**
 * Assignment with variant details
 */
export type AssignmentWithVariant = ExperimentAssignment & {
  variant: ExperimentVariant
  experiment: Experiment
}

/**
 * Input for creating a new experiment
 */
export interface CreateExperimentInput {
  name: string
  description?: string
  hypothesis?: string
  trafficPercent?: number
  successMetric?: string
  startDate?: Date
  endDate?: Date
  variants: CreateVariantInput[]
}

/**
 * Input for creating a variant
 */
export interface CreateVariantInput {
  name: string
  description?: string
  weight: number
  config?: Record<string, unknown>
}

/**
 * Input for updating an experiment
 */
export interface UpdateExperimentInput {
  name?: string
  description?: string
  hypothesis?: string
  trafficPercent?: number
  successMetric?: string
  startDate?: Date | null
  endDate?: Date | null
  status?: ExperimentStatus
}

/**
 * Filters for listing experiments
 */
export interface ExperimentFilters {
  status?: ExperimentStatus
  search?: string
  activeOnly?: boolean
}

/**
 * User context for experiment assignment
 */
export interface ExperimentContext {
  userId: string
  companyId?: string
  userAgent?: string
  country?: string
  createdAt?: Date
}

/**
 * Result of experiment assignment
 */
export interface ExperimentAssignmentResult {
  experimentId: string
  experimentName: string
  variantId: string
  variantName: string
  config?: Record<string, unknown>
  isControl: boolean
  assignedAt: Date
  exposedAt?: Date
}

/**
 * Experiment metrics for analysis
 */
export interface ExperimentMetrics {
  experimentId: string
  experimentName: string
  status: ExperimentStatus
  startDate?: Date
  endDate?: Date
  totalUsers: number
  variantMetrics: VariantMetrics[]
  winner?: string
  confidence?: number
}

/**
 * Metrics for a single variant
 */
export interface VariantMetrics {
  variantId: string
  variantName: string
  weight: number
  assignedUsers: number
  exposedUsers: number
  convertedUsers: number
  conversionRate: number
  eventsCount: Record<string, number>
}

/**
 * Statistical significance test result
 */
export interface SignificanceTestResult {
  significant: boolean
  pValue: number
  confidence: number
  winner?: string
  liftPercent?: number
  sampleSize: number
  recommendedAction: "continue" | "declare_winner" | "stop_test"
}

/**
 * Event tracking input
 */
export interface TrackExperimentEventInput {
  experimentId: string
  userId: string
  eventType: "view" | "click" | "conversion" | "custom"
  eventName: string
  properties?: Record<string, unknown>
}

/**
 * Assignment options
 */
export interface AssignmentOptions {
  forceVariant?: string
  skipExposure?: boolean
  context?: Partial<ExperimentContext>
}
