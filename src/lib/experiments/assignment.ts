/**
 * Experiment Assignment Logic
 *
 * Handles user assignment to experiment variants with sticky sessions.
 * Uses consistent hashing to ensure users always see the same variant.
 *
 * @see GitHub issue #292
 */

import { prisma } from "@/lib/db"
import type {
  ExperimentContext,
  ExperimentAssignmentResult,
  AssignmentOptions,
  ExperimentWithRelations,
} from "./types"
import type { ExperimentVariant } from "@prisma/client"
import { isExperimentActive } from "./manager"

/**
 * Assign a user to a variant in an experiment.
 * If user is already assigned, returns existing assignment (sticky).
 * If not assigned, uses consistent hashing to assign to a variant.
 */
export async function assignUserToExperiment(
  experimentId: string,
  userId: string,
  options?: AssignmentOptions
): Promise<ExperimentAssignmentResult | null> {
  // Check for existing assignment
  const existingAssignment = await prisma.experimentAssignment.findUnique({
    where: {
      experimentId_userId: {
        experimentId,
        userId,
      },
    },
    include: {
      variant: true,
      experiment: true,
    },
  })

  if (existingAssignment) {
    return {
      experimentId: existingAssignment.experimentId,
      experimentName: existingAssignment.experiment.name,
      variantId: existingAssignment.variantId,
      variantName: existingAssignment.variant.name,
      config: existingAssignment.variant.config as Record<string, unknown> | undefined,
      isControl: existingAssignment.variant.name === "control",
      assignedAt: existingAssignment.assignedAt,
      exposedAt: existingAssignment.exposedAt ?? undefined,
    }
  }

  // Get experiment details
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      variants: true,
    },
  })

  if (!experiment) {
    throw new Error(`Experiment ${experimentId} not found`)
  }

  // Check if experiment is active
  if (!isExperimentActive(experiment)) {
    return null
  }

  // Check if user should be included based on traffic percentage
  if (!shouldIncludeUser(userId, experimentId, experiment.trafficPercent)) {
    return null
  }

  // Determine variant assignment
  let variant: ExperimentVariant

  if (options?.forceVariant) {
    // Force specific variant (useful for testing)
    const forcedVariant = experiment.variants.find((v) => v.name === options.forceVariant)
    if (!forcedVariant) {
      throw new Error(`Variant ${options.forceVariant} not found in experiment ${experimentId}`)
    }
    variant = forcedVariant
  } else {
    // Use consistent hashing to assign variant
    variant = selectVariantByWeight(userId, experimentId, experiment.variants)
  }

  // Create assignment
  const assignment = await prisma.experimentAssignment.create({
    data: {
      experimentId,
      userId,
      variantId: variant.id,
      exposedAt: options?.skipExposure ? null : new Date(),
    },
    include: {
      variant: true,
      experiment: true,
    },
  })

  return {
    experimentId: assignment.experimentId,
    experimentName: assignment.experiment.name,
    variantId: assignment.variantId,
    variantName: assignment.variant.name,
    config: assignment.variant.config as Record<string, unknown> | undefined,
    isControl: assignment.variant.name === "control",
    assignedAt: assignment.assignedAt,
    exposedAt: assignment.exposedAt ?? undefined,
  }
}

/**
 * Get user's assignment for an experiment
 */
export async function getUserAssignment(
  experimentId: string,
  userId: string
): Promise<ExperimentAssignmentResult | null> {
  const assignment = await prisma.experimentAssignment.findUnique({
    where: {
      experimentId_userId: {
        experimentId,
        userId,
      },
    },
    include: {
      variant: true,
      experiment: true,
    },
  })

  if (!assignment) {
    return null
  }

  return {
    experimentId: assignment.experimentId,
    experimentName: assignment.experiment.name,
    variantId: assignment.variantId,
    variantName: assignment.variant.name,
    config: assignment.variant.config as Record<string, unknown> | undefined,
    isControl: assignment.variant.name === "control",
    assignedAt: assignment.assignedAt,
    exposedAt: assignment.exposedAt ?? undefined,
  }
}

/**
 * Get all active experiments for a user
 */
export async function getUserExperiments(userId: string): Promise<ExperimentAssignmentResult[]> {
  const assignments = await prisma.experimentAssignment.findMany({
    where: {
      userId,
      experiment: {
        status: "RUNNING",
      },
    },
    include: {
      variant: true,
      experiment: true,
    },
  })

  return assignments.map((assignment) => ({
    experimentId: assignment.experimentId,
    experimentName: assignment.experiment.name,
    variantId: assignment.variantId,
    variantName: assignment.variant.name,
    config: assignment.variant.config as Record<string, unknown> | undefined,
    isControl: assignment.variant.name === "control",
    assignedAt: assignment.assignedAt,
    exposedAt: assignment.exposedAt ?? undefined,
  }))
}

/**
 * Mark exposure (when user actually sees the variant)
 */
export async function markExposure(experimentId: string, userId: string): Promise<void> {
  await prisma.experimentAssignment.update({
    where: {
      experimentId_userId: {
        experimentId,
        userId,
      },
    },
    data: {
      exposedAt: new Date(),
    },
  })
}

/**
 * Mark conversion (when user completes the success metric)
 */
export async function markConversion(experimentId: string, userId: string): Promise<void> {
  await prisma.experimentAssignment.update({
    where: {
      experimentId_userId: {
        experimentId,
        userId,
      },
    },
    data: {
      convertedAt: new Date(),
    },
  })
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine if a user should be included in the experiment based on traffic percentage
 */
function shouldIncludeUser(userId: string, experimentId: string, trafficPercent: number): boolean {
  if (trafficPercent >= 100) {
    return true
  }

  if (trafficPercent <= 0) {
    return false
  }

  // Use consistent hashing to determine inclusion
  const hash = hashString(`${userId}:${experimentId}:traffic`)
  const bucket = hash % 100

  return bucket < trafficPercent
}

/**
 * Select a variant based on weights using consistent hashing
 */
function selectVariantByWeight(
  userId: string,
  experimentId: string,
  variants: ExperimentVariant[]
): ExperimentVariant {
  if (variants.length === 0) {
    throw new Error("No variants available")
  }

  if (variants.length === 1) {
    return variants[0]
  }

  // Sort variants by ID for consistency
  const sortedVariants = [...variants].sort((a, b) => a.id.localeCompare(b.id))

  // Hash to get a value between 0 and 99
  const hash = hashString(`${userId}:${experimentId}:variant`)
  const bucket = hash % 100

  // Accumulate weights and find the variant
  let accumulated = 0
  for (const variant of sortedVariants) {
    accumulated += variant.weight
    if (bucket < accumulated) {
      return variant
    }
  }

  // Fallback to last variant (shouldn't happen if weights sum to 100)
  return sortedVariants[sortedVariants.length - 1]
}

/**
 * Simple string hash for consistent bucketing
 * Same implementation as in feature-flags.ts for consistency
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
 * Batch assign multiple users to an experiment
 * Useful for backfilling assignments
 */
export async function batchAssignUsers(
  experimentId: string,
  userIds: string[]
): Promise<ExperimentAssignmentResult[]> {
  const results: ExperimentAssignmentResult[] = []

  for (const userId of userIds) {
    const result = await assignUserToExperiment(experimentId, userId)
    if (result) {
      results.push(result)
    }
  }

  return results
}
