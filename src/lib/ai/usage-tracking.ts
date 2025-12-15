import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

/**
 * AI operations that can be tracked
 */
export type AIOperation =
  | 'ocr_receipt'
  | 'extract_receipt'
  | 'extract_invoice'
  | 'categorize_expense'

/**
 * Model pricing in cents (EUR) per 1M tokens
 * Based on OpenAI pricing as of 2024
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': {
    input: 250, // $2.50 per 1M input tokens
    output: 1000, // $10.00 per 1M output tokens
  },
  'gpt-4o-mini': {
    input: 15, // $0.15 per 1M input tokens
    output: 60, // $0.60 per 1M output tokens
  },
}

/**
 * Calculate cost in cents based on tokens used
 */
function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) {
    logger.warn({ model }, 'Unknown AI model, cannot calculate cost')
    return 0
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return Math.ceil(inputCost + outputCost)
}

/**
 * Track AI usage for a company
 */
export async function trackAIUsage(params: {
  companyId: string
  operation: AIOperation
  model?: string
  inputTokens?: number
  outputTokens?: number
  success?: boolean
}): Promise<void> {
  try {
    const {
      companyId,
      operation,
      model,
      inputTokens = 0,
      outputTokens = 0,
      success = true,
    } = params

    const tokensUsed = inputTokens + outputTokens
    const costCents = model
      ? calculateCost(model, inputTokens, outputTokens)
      : null

    await db.aIUsage.create({
      data: {
        companyId,
        operation,
        model: model || null,
        tokensUsed: tokensUsed > 0 ? tokensUsed : null,
        costCents,
        success,
      },
    })

    logger.info(
      {
        companyId,
        operation,
        model,
        tokensUsed,
        costCents,
        success,
      },
      'AI usage tracked'
    )
  } catch (error) {
    // Don't fail the operation if tracking fails
    logger.error({ error, params }, 'Failed to track AI usage')
  }
}

/**
 * Get total usage for current month
 */
export async function getUsageThisMonth(companyId: string): Promise<{
  totalCalls: number
  totalTokens: number
  totalCostCents: number
  byOperation: Record<
    string,
    { calls: number; tokens: number; costCents: number }
  >
}> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const usage = await db.aIUsage.findMany({
    where: {
      companyId,
      createdAt: {
        gte: startOfMonth,
      },
    },
    select: {
      operation: true,
      tokensUsed: true,
      costCents: true,
    },
  })

  const byOperation: Record<
    string,
    { calls: number; tokens: number; costCents: number }
  > = {}

  let totalCalls = 0
  let totalTokens = 0
  let totalCostCents = 0

  for (const record of usage) {
    totalCalls++
    totalTokens += record.tokensUsed || 0
    totalCostCents += record.costCents || 0

    if (!byOperation[record.operation]) {
      byOperation[record.operation] = { calls: 0, tokens: 0, costCents: 0 }
    }

    byOperation[record.operation].calls++
    byOperation[record.operation].tokens += record.tokensUsed || 0
    byOperation[record.operation].costCents += record.costCents || 0
  }

  return {
    totalCalls,
    totalTokens,
    totalCostCents,
    byOperation,
  }
}

/**
 * Get usage statistics for a date range
 */
export async function getUsageStats(
  companyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalCalls: number
  totalTokens: number
  totalCostCents: number
  successRate: number
  byOperation: Record<
    string,
    {
      calls: number
      tokens: number
      costCents: number
      successRate: number
    }
  >
}> {
  const usage = await db.aIUsage.findMany({
    where: {
      companyId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      operation: true,
      tokensUsed: true,
      costCents: true,
      success: true,
    },
  })

  const byOperation: Record<
    string,
    {
      calls: number
      tokens: number
      costCents: number
      successCalls: number
      successRate: number
    }
  > = {}

  let totalCalls = 0
  let totalTokens = 0
  let totalCostCents = 0
  let totalSuccessCalls = 0

  for (const record of usage) {
    totalCalls++
    totalTokens += record.tokensUsed || 0
    totalCostCents += record.costCents || 0
    if (record.success) totalSuccessCalls++

    if (!byOperation[record.operation]) {
      byOperation[record.operation] = {
        calls: 0,
        tokens: 0,
        costCents: 0,
        successCalls: 0,
        successRate: 0,
      }
    }

    const op = byOperation[record.operation]
    op.calls++
    op.tokens += record.tokensUsed || 0
    op.costCents += record.costCents || 0
    if (record.success) op.successCalls++
  }

  // Calculate success rates
  for (const op of Object.values(byOperation)) {
    op.successRate = op.calls > 0 ? op.successCalls / op.calls : 0
  }

  return {
    totalCalls,
    totalTokens,
    totalCostCents,
    successRate: totalCalls > 0 ? totalSuccessCalls / totalCalls : 0,
    byOperation,
  }
}

/**
 * Check if company has exceeded their AI budget for the month
 */
export async function hasExceededBudget(
  companyId: string,
  budgetCents?: number
): Promise<boolean> {
  if (!budgetCents) return false

  const usage = await getUsageThisMonth(companyId)
  return usage.totalCostCents >= budgetCents
}
