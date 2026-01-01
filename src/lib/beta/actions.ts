"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"

const betaFeedbackSchema = z.object({
  feature: z.string().min(1),
  rating: z.number().min(1).max(5).optional(),
  feedback: z.string().max(2000).optional(),
  category: z.enum(["bug", "suggestion", "praise", "other"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Toggle user's beta opt-in status.
 * When opting in, records the timestamp.
 * When opting out, clears the timestamp.
 */
export async function toggleBetaOptIn(optIn: boolean) {
  const user = await requireAuth()

  await db.user.update({
    where: { id: user.id },
    data: {
      betaOptIn: optIn,
      betaOptInAt: optIn ? new Date() : null,
    },
  })

  return { success: true, betaOptIn: optIn }
}

/**
 * Get the current user's beta status.
 */
export async function getBetaStatus() {
  const user = await requireAuth()

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: {
      betaOptIn: true,
      betaOptInAt: true,
    },
  })

  return {
    betaOptIn: dbUser?.betaOptIn ?? false,
    betaOptInAt: dbUser?.betaOptInAt ?? null,
  }
}

/**
 * Submit feedback for a beta feature.
 */
export async function submitBetaFeedback(data: z.infer<typeof betaFeedbackSchema>) {
  const user = await requireAuth()
  const validated = betaFeedbackSchema.parse(data)

  await db.betaFeedback.create({
    data: {
      userId: user.id!,
      feature: validated.feature,
      rating: validated.rating,
      feedback: validated.feedback,
      category: validated.category,
      metadata: validated.metadata,
    },
  })

  return { success: true }
}

/**
 * Get user's beta feedback history.
 */
export async function getUserBetaFeedback(limit = 10) {
  const user = await requireAuth()

  const feedback = await db.betaFeedback.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      feature: true,
      rating: true,
      feedback: true,
      category: true,
      createdAt: true,
    },
  })

  return feedback
}
