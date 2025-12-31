/**
 * Experiment Statistical Analysis
 *
 * Calculate metrics and statistical significance for A/B tests.
 * Uses chi-square test for conversion rate comparison.
 *
 * @see GitHub issue #292
 */

import { prisma } from "@/lib/db"
import type { ExperimentMetrics, VariantMetrics, SignificanceTestResult } from "./types"

/**
 * Get comprehensive metrics for an experiment
 */
export async function getExperimentMetrics(experimentId: string): Promise<ExperimentMetrics> {
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      variants: true,
      assignments: true,
      events: true,
    },
  })

  if (!experiment) {
    throw new Error(`Experiment ${experimentId} not found`)
  }

  // Calculate metrics for each variant
  const variantMetrics: VariantMetrics[] = await Promise.all(
    experiment.variants.map((variant) => calculateVariantMetrics(experimentId, variant.id))
  )

  // Calculate total users across all variants
  const totalUsers = variantMetrics.reduce((sum, v) => sum + v.assignedUsers, 0)

  // Determine winner if experiment is completed
  let winner: string | undefined
  let confidence: number | undefined

  if (experiment.status === "COMPLETED" && variantMetrics.length === 2) {
    const significance = calculateSignificance(variantMetrics[0], variantMetrics[1])
    if (significance.significant) {
      winner = significance.winner
      confidence = significance.confidence
    }
  }

  return {
    experimentId: experiment.id,
    experimentName: experiment.name,
    status: experiment.status,
    startDate: experiment.startDate ?? undefined,
    endDate: experiment.endDate ?? undefined,
    totalUsers,
    variantMetrics,
    winner,
    confidence,
  }
}

/**
 * Calculate metrics for a specific variant
 */
export async function calculateVariantMetrics(
  experimentId: string,
  variantId: string
): Promise<VariantMetrics> {
  const variant = await prisma.experimentVariant.findUnique({
    where: { id: variantId },
  })

  if (!variant) {
    throw new Error(`Variant ${variantId} not found`)
  }

  // Count assigned users
  const assignedUsers = await prisma.experimentAssignment.count({
    where: {
      experimentId,
      variantId,
    },
  })

  // Count exposed users (saw the variant)
  const exposedUsers = await prisma.experimentAssignment.count({
    where: {
      experimentId,
      variantId,
      exposedAt: { not: null },
    },
  })

  // Count converted users
  const convertedUsers = await prisma.experimentAssignment.count({
    where: {
      experimentId,
      variantId,
      convertedAt: { not: null },
    },
  })

  // Calculate conversion rate
  const conversionRate = exposedUsers > 0 ? (convertedUsers / exposedUsers) * 100 : 0

  // Get event counts by name
  const eventCounts = await prisma.experimentEvent.groupBy({
    by: ["eventName"],
    where: {
      experimentId,
      variantId,
    },
    _count: {
      eventName: true,
    },
  })

  const eventsCount: Record<string, number> = {}
  for (const event of eventCounts) {
    eventsCount[event.eventName] = event._count.eventName
  }

  return {
    variantId,
    variantName: variant.name,
    weight: variant.weight,
    assignedUsers,
    exposedUsers,
    convertedUsers,
    conversionRate,
    eventsCount,
  }
}

/**
 * Calculate statistical significance between two variants
 * Uses chi-square test for conversion rates
 */
export function calculateSignificance(
  control: VariantMetrics,
  treatment: VariantMetrics
): SignificanceTestResult {
  const n1 = control.exposedUsers
  const n2 = treatment.exposedUsers
  const x1 = control.convertedUsers
  const x2 = treatment.convertedUsers

  // Need minimum sample size
  if (n1 < 30 || n2 < 30) {
    return {
      significant: false,
      pValue: 1,
      confidence: 0,
      sampleSize: n1 + n2,
      recommendedAction: "continue",
    }
  }

  // Calculate conversion rates
  const p1 = x1 / n1
  const p2 = x2 / n2

  // Pooled proportion
  const pPool = (x1 + x2) / (n1 + n2)

  // Standard error
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2))

  // Z-score
  const z = (p2 - p1) / se

  // P-value (two-tailed test)
  const pValue = 2 * (1 - normalCDF(Math.abs(z)))

  // Determine significance (p < 0.05)
  const significant = pValue < 0.05
  const confidence = (1 - pValue) * 100

  // Calculate lift
  const liftPercent = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0

  // Determine winner
  let winner: string | undefined
  if (significant) {
    winner = p2 > p1 ? treatment.variantName : control.variantName
  }

  // Recommended action
  let recommendedAction: "continue" | "declare_winner" | "stop_test"
  if (significant) {
    recommendedAction = "declare_winner"
  } else if (n1 + n2 > 10000) {
    // Large sample size but not significant - probably no difference
    recommendedAction = "stop_test"
  } else {
    recommendedAction = "continue"
  }

  return {
    significant,
    pValue,
    confidence,
    winner,
    liftPercent,
    sampleSize: n1 + n2,
    recommendedAction,
  }
}

/**
 * Normal CDF approximation using error function
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const prob =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - prob : prob
}

/**
 * Calculate required sample size for desired statistical power
 */
export function calculateRequiredSampleSize(
  baselineConversionRate: number,
  minimumDetectableEffect: number,
  power = 0.8,
  alpha = 0.05
): number {
  // Simplified sample size calculation
  const p1 = baselineConversionRate
  const p2 = p1 * (1 + minimumDetectableEffect)

  // Z-scores for alpha and power
  const zAlpha = 1.96 // for 0.05 two-tailed
  const zBeta = 0.84 // for 0.8 power

  // Average proportion
  const pAvg = (p1 + p2) / 2

  // Sample size per variant
  const n =
    (zAlpha * Math.sqrt(2 * pAvg * (1 - pAvg)) +
      zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) **
      2 /
    (p2 - p1) ** 2

  return Math.ceil(n)
}

/**
 * Get experiment summary report
 */
export async function getExperimentReport(experimentId: string): Promise<{
  metrics: ExperimentMetrics
  significance?: SignificanceTestResult
}> {
  const metrics = await getExperimentMetrics(experimentId)

  // Calculate significance if there are exactly 2 variants
  let significance: SignificanceTestResult | undefined
  if (metrics.variantMetrics.length === 2) {
    significance = calculateSignificance(metrics.variantMetrics[0], metrics.variantMetrics[1])
  }

  return {
    metrics,
    significance,
  }
}

/**
 * Compare multiple variants (more than 2)
 * Returns the best performing variant based on conversion rate
 */
export async function compareMultipleVariants(experimentId: string): Promise<{
  variants: VariantMetrics[]
  bestVariant: VariantMetrics
  worstVariant: VariantMetrics
}> {
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      variants: true,
    },
  })

  if (!experiment) {
    throw new Error(`Experiment ${experimentId} not found`)
  }

  const variants = await Promise.all(
    experiment.variants.map((v) => calculateVariantMetrics(experimentId, v.id))
  )

  // Sort by conversion rate
  const sorted = [...variants].sort((a, b) => b.conversionRate - a.conversionRate)

  return {
    variants: sorted,
    bestVariant: sorted[0],
    worstVariant: sorted[sorted.length - 1],
  }
}
