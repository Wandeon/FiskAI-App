import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  submitFeedback,
  getFeedbackStats,
  getRecentFeedback,
} from '@/lib/ai/feedback'
import { withApiLogging } from '@/lib/api-logging'
import { updateContext } from '@/lib/context'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const feedbackSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  operation: z.enum(['ocr_receipt', 'ocr_invoice', 'category_suggestion']),
  feedback: z.enum(['correct', 'incorrect', 'partial']),
  correction: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
})

/**
 * POST /api/ai/feedback
 * Submit feedback about AI extraction/suggestion
 */
export const POST = withApiLogging(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  updateContext({ userId: session.user.id })

  try {
    const body = await req.json()

    // Validate input
    const validation = feedbackSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Get user's company
    const companyUser = await db.companyUser.findFirst({
      where: { userId: session.user.id, isDefault: true },
      include: { company: true },
    })

    if (!companyUser?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    updateContext({ companyId: companyUser.company.id })

    // Submit feedback
    const result = await submitFeedback({
      companyId: companyUser.company.id,
      userId: session.user.id,
      entityType: data.entityType,
      entityId: data.entityId,
      operation: data.operation,
      feedback: data.feedback,
      correction: data.correction,
      notes: data.notes,
    })

    return NextResponse.json(result)
  } catch (error) {
    logger.error({ error }, 'Failed to submit AI feedback')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit feedback' },
      { status: 500 }
    )
  }
})

/**
 * GET /api/ai/feedback
 * Get feedback statistics or recent feedback
 */
export const GET = withApiLogging(async (req: NextRequest) => {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  updateContext({ userId: session.user.id })

  try {
    // Get user's company
    const companyUser = await db.companyUser.findFirst({
      where: { userId: session.user.id, isDefault: true },
      include: { company: true },
    })

    if (!companyUser?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    updateContext({ companyId: companyUser.company.id })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'stats'
    const operation = searchParams.get('operation') || undefined
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    if (type === 'recent') {
      const feedback = await getRecentFeedback(companyUser.company.id, limit)
      return NextResponse.json({ feedback })
    }

    // Default: return stats
    const stats = await getFeedbackStats(companyUser.company.id, operation)
    return NextResponse.json({ stats })
  } catch (error) {
    logger.error({ error }, 'Failed to get AI feedback')
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get feedback' },
      { status: 500 }
    )
  }
})
