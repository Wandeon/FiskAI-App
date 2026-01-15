import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

/**
 * AI operations that can be tracked
 */
export type AIOperation =
  | "ocr_receipt"
  | "extract_receipt"
  | "extract_invoice"
  | "categorize_expense"
  | "ollama_chat"
  | "ollama_vision"
  | "ollama_news_classify"
  | "ollama_news_write"
  | "ollama_news_review"
  | "ollama_news_rewrite"
  | "ollama_assistant"

/**
 * Model pricing in cents (EUR) per 1M tokens
 *
 * Ollama models run locally (free) or via Ollama Cloud.
 * For local models, cost is 0. For cloud models, pricing varies by provider.
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Local Ollama models - free (compute cost only)
  "llama3.2": { input: 0, output: 0 },
  "llama3.2:3b": { input: 0, output: 0 },
  "llama3.2:70b": { input: 0, output: 0 },
  llava: { input: 0, output: 0 },
  "qwen3-next:80b": { input: 0, output: 0 },
  // Gemini models via Ollama Cloud
  "gemini-2.0-flash": { input: 10, output: 40 },
  "gemini-2.5-flash-preview-05-20": { input: 15, output: 60 },
}

/**
 * Calculate cost in cents based on tokens used
 */
function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) {
    logger.warn({ model }, "Unknown AI model, cannot calculate cost")
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
  durationMs?: number
  provider?: string
}): Promise<void> {
  try {
    const {
      companyId,
      operation,
      model,
      inputTokens = 0,
      outputTokens = 0,
      success = true,
      durationMs,
      provider,
    } = params

    const tokensUsed = inputTokens + outputTokens
    const costCents = model ? calculateCost(model, inputTokens, outputTokens) : null

    await db.aIUsage.create({
      data: {
        companyId,
        operation,
        model: model || null,
        tokensUsed: tokensUsed > 0 ? tokensUsed : null,
        costCents,
        success,
        durationMs: durationMs ?? null,
        provider: provider ?? null,
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
        durationMs,
        provider,
      },
      "AI usage tracked"
    )
  } catch (error) {
    // Don't fail the operation if tracking fails
    logger.error({ error, params }, "Failed to track AI usage")
  }
}

/**
 * Get total usage for current month
 */
export async function getUsageThisMonth(companyId: string): Promise<{
  totalCalls: number
  totalTokens: number
  totalCostCents: number
  byOperation: Record<string, { calls: number; tokens: number; costCents: number }>
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

  const byOperation: Record<string, { calls: number; tokens: number; costCents: number }> = {}

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
export async function hasExceededBudget(companyId: string, budgetCents?: number): Promise<boolean> {
  if (!budgetCents) return false

  const usage = await getUsageThisMonth(companyId)
  return usage.totalCostCents >= budgetCents
}
