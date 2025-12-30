import { logger } from "@/lib/logger"
import { db } from "@/lib/db"
import { getUsageThisMonth, type AIOperation } from "./usage-tracking"

/**
 * Rate limits per plan (monthly limits)
 */
const PLAN_LIMITS: Record<
  string,
  {
    totalCalls: number
    totalCostCents: number
    perOperationLimits?: Partial<Record<AIOperation, number>>
  }
> = {
  pausalni: {
    totalCalls: 100, // 100 AI calls per month
    totalCostCents: 200, // 2 EUR per month
    perOperationLimits: {
      ocr_receipt: 50,
      extract_receipt: 50,
      extract_invoice: 30,
    },
  },
  obrtnicki: {
    totalCalls: 500, // 500 AI calls per month
    totalCostCents: 1000, // 10 EUR per month
    perOperationLimits: {
      ocr_receipt: 250,
      extract_receipt: 250,
      extract_invoice: 150,
    },
  },
  obrt_vat: {
    totalCalls: 1000, // 1000 AI calls per month
    totalCostCents: 2000, // 20 EUR per month
  },
  doo_small: {
    totalCalls: 2000, // 2000 AI calls per month
    totalCostCents: 5000, // 50 EUR per month
  },
  doo_standard: {
    totalCalls: 5000, // 5000 AI calls per month
    totalCostCents: 10000, // 100 EUR per month
  },
  enterprise: {
    totalCalls: 999999, // Unlimited
    totalCostCents: 999999, // Unlimited
  },
  // Default for trial or unknown plans
  default: {
    totalCalls: 20, // 20 AI calls during trial
    totalCostCents: 50, // 0.50 EUR during trial
  },
}

/**
 * Options for InMemoryRateLimiter
 */
interface InMemoryRateLimiterOptions {
  windowMs?: number
  maxRequests?: number
}

/**
 * In-memory rate limiter for short-term rate limiting (per-minute)
 * This prevents abuse by limiting requests per minute per company
 */
export class InMemoryRateLimiter {
  private requests: Map<string, { count: number; resetAt: number }> = new Map()
  private readonly windowMs: number
  private readonly maxRequestsPerWindow: number

  constructor(options: InMemoryRateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? 60 * 1000 // 1 minute default
    this.maxRequestsPerWindow = options.maxRequests ?? 10 // 10 requests per minute default
  }

  check(companyId: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now()
    const key = companyId
    const entry = this.requests.get(key)

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
      this.cleanup()
    }

    if (!entry || entry.resetAt <= now) {
      // New window
      this.requests.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      })
      return { allowed: true }
    }

    if (entry.count >= this.maxRequestsPerWindow) {
      return {
        allowed: false,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      }
    }

    entry.count++
    return { allowed: true }
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.requests.entries()) {
      if (entry.resetAt <= now) {
        this.requests.delete(key)
      }
    }
  }
}

const inMemoryLimiter = new InMemoryRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
})

/**
 * Check if a company can make an AI request
 */
export async function checkRateLimit(
  companyId: string,
  operation: AIOperation
): Promise<{
  allowed: boolean
  reason?: string
  retryAfter?: number
  usage?: {
    current: number
    limit: number
    remaining: number
  }
}> {
  try {
    // First check in-memory rate limiter (per-minute)
    const shortTermCheck = inMemoryLimiter.check(companyId)
    if (!shortTermCheck.allowed) {
      logger.warn({ companyId, operation }, "Rate limit exceeded (short-term)")
      return {
        allowed: false,
        reason: "Too many requests. Please wait a moment.",
        retryAfter: shortTermCheck.retryAfter,
      }
    }

    // Get company subscription plan
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
      },
    })

    if (!company) {
      return {
        allowed: false,
        reason: "Company not found",
      }
    }

    // Get plan limits
    const plan = company.subscriptionPlan || "default"
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.default

    // Get current month usage
    const usage = await getUsageThisMonth(companyId)

    // Check total calls limit
    if (usage.totalCalls >= limits.totalCalls) {
      logger.warn(
        {
          companyId,
          operation,
          current: usage.totalCalls,
          limit: limits.totalCalls,
        },
        "Monthly call limit exceeded"
      )
      return {
        allowed: false,
        reason: `Monthly AI usage limit reached (${limits.totalCalls} calls). Please upgrade your plan.`,
        usage: {
          current: usage.totalCalls,
          limit: limits.totalCalls,
          remaining: 0,
        },
      }
    }

    // Check total cost limit
    if (usage.totalCostCents >= limits.totalCostCents) {
      logger.warn(
        {
          companyId,
          operation,
          current: usage.totalCostCents,
          limit: limits.totalCostCents,
        },
        "Monthly cost limit exceeded"
      )
      return {
        allowed: false,
        reason: `Monthly AI budget limit reached. Please upgrade your plan.`,
        usage: {
          current: usage.totalCostCents,
          limit: limits.totalCostCents,
          remaining: 0,
        },
      }
    }

    // Check per-operation limits if configured
    if (limits.perOperationLimits?.[operation]) {
      const operationLimit = limits.perOperationLimits[operation]!
      const operationUsage = usage.byOperation[operation]?.calls || 0

      if (operationUsage >= operationLimit) {
        logger.warn(
          {
            companyId,
            operation,
            current: operationUsage,
            limit: operationLimit,
          },
          "Per-operation limit exceeded"
        )
        return {
          allowed: false,
          reason: `Monthly limit for ${operation} reached (${operationLimit} calls). Please upgrade your plan.`,
          usage: {
            current: operationUsage,
            limit: operationLimit,
            remaining: 0,
          },
        }
      }
    }

    // All checks passed
    return {
      allowed: true,
      usage: {
        current: usage.totalCalls,
        limit: limits.totalCalls,
        remaining: limits.totalCalls - usage.totalCalls,
      },
    }
  } catch (error) {
    // On error, allow the request but log the error
    logger.error({ error, companyId, operation }, "Rate limit check failed")
    return { allowed: true }
  }
}

/**
 * Get current usage and limits for a company
 */
export async function getUsageLimits(companyId: string): Promise<{
  plan: string
  limits: {
    totalCalls: number
    totalCostCents: number
    perOperationLimits?: Partial<Record<AIOperation, number>>
  }
  usage: {
    totalCalls: number
    totalTokens: number
    totalCostCents: number
    byOperation: Record<string, { calls: number; tokens: number; costCents: number }>
  }
  remaining: {
    calls: number
    costCents: number
  }
}> {
  // Get company subscription plan
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      subscriptionPlan: true,
    },
  })

  const plan = company?.subscriptionPlan || "default"
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.default

  // Get current month usage
  const usage = await getUsageThisMonth(companyId)

  return {
    plan,
    limits,
    usage,
    remaining: {
      calls: Math.max(0, limits.totalCalls - usage.totalCalls),
      costCents: Math.max(0, limits.totalCostCents - usage.totalCostCents),
    },
  }
}
