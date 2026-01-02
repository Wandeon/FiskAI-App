/**
 * Experiment Event Tracking
 *
 * Track events for experiments to measure impact.
 * Integrates with PostHog for analytics.
 *
 * @see GitHub issue #292
 */

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { trackExperimentExposure, trackExperimentEnrollment } from "@/lib/feature-analytics"
import type { TrackExperimentEventInput } from "./types"
import { getUserAssignment, markExposure, markConversion } from "./assignment"

/**
 * Track an experiment event
 */
export async function trackExperimentEvent(input: TrackExperimentEventInput): Promise<void> {
  const { experimentId, userId, eventType, eventName, properties } = input

  // Get user's assignment
  const assignment = await getUserAssignment(experimentId, userId)

  if (!assignment) {
    // User not assigned to this experiment
    return
  }

  // Create event record
  await prisma.experimentEvent.create({
    data: {
      experimentId,
      userId,
      variantId: assignment.variantId,
      eventType,
      eventName,
      properties: (properties as Prisma.InputJsonValue) ?? undefined,
    },
  })

  // Track conversion if this is a conversion event
  if (eventType === "conversion") {
    await markConversion(experimentId, userId)
  }

  // Send to PostHog for analytics
  trackExperimentExposure(assignment.experimentName, assignment.variantName, {
    eventType,
    eventName,
    ...properties,
  })
}

/**
 * Track experiment exposure (when user sees the variant)
 */
export async function trackExposure(experimentId: string, userId: string): Promise<void> {
  const assignment = await getUserAssignment(experimentId, userId)

  if (!assignment) {
    return
  }

  // Mark exposure in database
  await markExposure(experimentId, userId)

  // Track in PostHog
  trackExperimentExposure(assignment.experimentName, assignment.variantName)
}

/**
 * Track experiment enrollment (when user is first assigned)
 */
export async function trackEnrollment(
  experimentId: string,
  userId: string,
  variantName: string
): Promise<void> {
  const assignment = await getUserAssignment(experimentId, userId)

  if (!assignment) {
    return
  }

  // Track in PostHog
  trackExperimentEnrollment(assignment.experimentName, variantName)
}

/**
 * Track a conversion event
 */
export async function trackConversion(
  experimentId: string,
  userId: string,
  conversionName: string,
  properties?: Record<string, unknown>
): Promise<void> {
  await trackExperimentEvent({
    experimentId,
    userId,
    eventType: "conversion",
    eventName: conversionName,
    properties,
  })
}

/**
 * Get events for an experiment
 */
export async function getExperimentEvents(experimentId: string, limit = 100) {
  return prisma.experimentEvent.findMany({
    where: { experimentId },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: {
      variant: true,
    },
  })
}

/**
 * Get events for a specific user in an experiment
 */
export async function getUserExperimentEvents(experimentId: string, userId: string, limit = 50) {
  return prisma.experimentEvent.findMany({
    where: {
      experimentId,
      userId,
    },
    orderBy: { timestamp: "desc" },
    take: limit,
    include: {
      variant: true,
    },
  })
}

/**
 * Get event counts by type for an experiment
 */
export async function getEventCountsByType(experimentId: string): Promise<Record<string, number>> {
  const events = await prisma.experimentEvent.groupBy({
    by: ["eventType"],
    where: { experimentId },
    _count: {
      eventType: true,
    },
  })

  return events.reduce(
    (acc, item) => {
      acc[item.eventType] = item._count.eventType
      return acc
    },
    {} as Record<string, number>
  )
}

/**
 * Get event counts by name for an experiment
 */
export async function getEventCountsByName(experimentId: string): Promise<Record<string, number>> {
  const events = await prisma.experimentEvent.groupBy({
    by: ["eventName"],
    where: { experimentId },
    _count: {
      eventName: true,
    },
  })

  return events.reduce(
    (acc, item) => {
      acc[item.eventName] = item._count.eventName
      return acc
    },
    {} as Record<string, number>
  )
}
