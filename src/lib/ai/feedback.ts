import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

export interface SubmitFeedbackInput {
  companyId: string
  userId: string
  entityType: string
  entityId: string
  operation: string
  feedback: 'correct' | 'incorrect' | 'partial'
  correction?: Record<string, unknown>
  notes?: string
}

export interface FeedbackStats {
  total: number
  correct: number
  incorrect: number
  partial: number
  accuracy: number
}

/**
 * Submit user feedback about AI extraction/suggestion
 */
export async function submitFeedback(input: SubmitFeedbackInput) {
  try {
    const feedback = await db.aIFeedback.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        operation: input.operation,
        feedback: input.feedback,
        correction: input.correction || null,
        notes: input.notes || null,
      },
    })

    logger.info(
      {
        feedbackId: feedback.id,
        operation: input.operation,
        feedback: input.feedback,
        entityType: input.entityType,
      },
      'AI feedback submitted'
    )

    return { success: true, feedback }
  } catch (error) {
    logger.error({ error, input }, 'Failed to submit AI feedback')
    throw error
  }
}

/**
 * Get feedback history for a specific entity
 */
export async function getFeedbackForEntity(
  entityType: string,
  entityId: string
) {
  try {
    const feedback = await db.aIFeedback.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return feedback
  } catch (error) {
    logger.error({ error, entityType, entityId }, 'Failed to get feedback')
    throw error
  }
}

/**
 * Get feedback statistics for a company and operation
 */
export async function getFeedbackStats(
  companyId: string,
  operation?: string
): Promise<FeedbackStats> {
  try {
    const where = {
      companyId,
      ...(operation && { operation }),
    }

    const feedbackList = await db.aIFeedback.findMany({
      where,
      select: {
        feedback: true,
      },
    })

    const total = feedbackList.length
    const correct = feedbackList.filter((f) => f.feedback === 'correct').length
    const incorrect = feedbackList.filter((f) => f.feedback === 'incorrect').length
    const partial = feedbackList.filter((f) => f.feedback === 'partial').length

    const accuracy = total > 0 ? ((correct + partial * 0.5) / total) * 100 : 0

    return {
      total,
      correct,
      incorrect,
      partial,
      accuracy: Math.round(accuracy * 100) / 100,
    }
  } catch (error) {
    logger.error({ error, companyId, operation }, 'Failed to get feedback stats')
    throw error
  }
}

/**
 * Get recent feedback for analytics/monitoring
 */
export async function getRecentFeedback(
  companyId: string,
  limit: number = 10
) {
  try {
    const feedback = await db.aIFeedback.findMany({
      where: {
        companyId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    })

    return feedback
  } catch (error) {
    logger.error({ error, companyId }, 'Failed to get recent feedback')
    throw error
  }
}
