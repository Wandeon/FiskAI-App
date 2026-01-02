/**
 * Experiment Manager
 *
 * Core functionality for creating and managing A/B tests.
 * @see GitHub issue #292
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import type {
  CreateExperimentInput,
  UpdateExperimentInput,
  ExperimentFilters,
  ExperimentWithRelations,
} from "./types"
import type { Experiment, ExperimentStatus } from "@prisma/client"

/**
 * Create a new experiment with variants
 */
export async function createExperiment(
  input: CreateExperimentInput,
  createdBy?: string
): Promise<ExperimentWithRelations> {
  // Validate weights sum to 100
  const totalWeight = input.variants.reduce((sum, v) => sum + v.weight, 0)
  if (totalWeight !== 100) {
    throw new Error(`Variant weights must sum to 100, got ${totalWeight}`)
  }

  // Create experiment with variants
  const experiment = await prisma.experiment.create({
    data: {
      name: input.name,
      description: input.description,
      hypothesis: input.hypothesis,
      trafficPercent: input.trafficPercent ?? 100,
      successMetric: input.successMetric,
      startDate: input.startDate,
      endDate: input.endDate,
      createdBy,
      status: "DRAFT",
      variants: {
        create: input.variants.map((variant) => ({
          name: variant.name,
          description: variant.description,
          weight: variant.weight,
          config: (variant.config as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        })),
      },
    },
    include: {
      variants: true,
    },
  })

  return experiment
}

/**
 * Get experiment by ID
 */
export async function getExperiment(id: string): Promise<ExperimentWithRelations | null> {
  return prisma.experiment.findUnique({
    where: { id },
    include: {
      variants: true,
      assignments: {
        include: {
          variant: true,
        },
      },
    },
  })
}

/**
 * Get experiment by name
 */
export async function getExperimentByName(name: string): Promise<ExperimentWithRelations | null> {
  return prisma.experiment.findUnique({
    where: { name },
    include: {
      variants: true,
    },
  })
}

/**
 * List all experiments with optional filters
 */
export async function listExperiments(filters?: ExperimentFilters): Promise<Experiment[]> {
  const where: Prisma.ExperimentWhereInput = {}

  if (filters?.status) {
    where.status = filters.status
  }

  if (filters?.activeOnly) {
    where.status = "RUNNING"
  }

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ]
  }

  return prisma.experiment.findMany({
    where,
    include: {
      variants: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

/**
 * Update an experiment
 */
export async function updateExperiment(
  id: string,
  input: UpdateExperimentInput
): Promise<ExperimentWithRelations> {
  const experiment = await prisma.experiment.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description,
      hypothesis: input.hypothesis,
      trafficPercent: input.trafficPercent,
      successMetric: input.successMetric,
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status,
    },
    include: {
      variants: true,
    },
  })

  return experiment
}

/**
 * Start an experiment (change status to RUNNING)
 */
export async function startExperiment(id: string): Promise<Experiment> {
  const experiment = await prisma.experiment.findUnique({
    where: { id },
    include: { variants: true },
  })

  if (!experiment) {
    throw new Error(`Experiment ${id} not found`)
  }

  if (experiment.status !== "DRAFT" && experiment.status !== "PAUSED") {
    throw new Error(`Cannot start experiment with status ${experiment.status}`)
  }

  if (experiment.variants.length < 2) {
    throw new Error("Experiment must have at least 2 variants")
  }

  return prisma.experiment.update({
    where: { id },
    data: {
      status: "RUNNING",
      startDate: new Date(),
    },
  })
}

/**
 * Pause an experiment
 */
export async function pauseExperiment(id: string): Promise<Experiment> {
  return prisma.experiment.update({
    where: { id },
    data: {
      status: "PAUSED",
    },
  })
}

/**
 * Complete an experiment
 */
export async function completeExperiment(
  id: string,
  results?: { controlValue?: number; variantValue?: number }
): Promise<Experiment> {
  return prisma.experiment.update({
    where: { id },
    data: {
      status: "COMPLETED",
      endDate: new Date(),
      controlValue: results?.controlValue,
      variantValue: results?.variantValue,
    },
  })
}

/**
 * Cancel an experiment
 */
export async function cancelExperiment(id: string): Promise<Experiment> {
  return prisma.experiment.update({
    where: { id },
    data: {
      status: "CANCELLED",
      endDate: new Date(),
    },
  })
}

/**
 * Delete an experiment (only if in DRAFT or CANCELLED status)
 */
export async function deleteExperiment(id: string): Promise<void> {
  const experiment = await prisma.experiment.findUnique({
    where: { id },
  })

  if (!experiment) {
    throw new Error(`Experiment ${id} not found`)
  }

  if (experiment.status !== "DRAFT" && experiment.status !== "CANCELLED") {
    throw new Error(`Cannot delete experiment with status ${experiment.status}`)
  }

  await prisma.experiment.delete({
    where: { id },
  })
}

/**
 * Get active experiments (RUNNING status)
 */
export async function getActiveExperiments(): Promise<ExperimentWithRelations[]> {
  return prisma.experiment.findMany({
    where: {
      status: "RUNNING",
    },
    include: {
      variants: true,
    },
  })
}

/**
 * Check if experiment is active
 */
export function isExperimentActive(experiment: Experiment): boolean {
  if (experiment.status !== "RUNNING") {
    return false
  }

  const now = new Date()

  if (experiment.startDate && now < experiment.startDate) {
    return false
  }

  if (experiment.endDate && now > experiment.endDate) {
    return false
  }

  return true
}
