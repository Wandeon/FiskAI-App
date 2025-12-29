// src/app/api/admin/sentinel/circuit-breaker/reset/route.ts

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { rateLimiter } from "@/lib/regulatory-truth/utils/rate-limiter"

/**
 * POST /api/admin/sentinel/circuit-breaker/reset
 *
 * Manually reset circuit breaker for a specific domain or all domains.
 * This allows administrators to override the automatic 1-hour timeout
 * and immediately restore service after transient issues are resolved.
 *
 * Request body:
 * - domain (optional): Specific domain to reset. If omitted, resets all domains.
 *
 * Response:
 * - success: boolean
 * - message: string
 * - reset: string[] - list of domains that were reset
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { domain } = body

    const resetDomains: string[] = []

    if (domain) {
      // Reset specific domain
      const status = rateLimiter.getStatus(domain)
      if (status.isCircuitBroken) {
        rateLimiter.resetCircuitBreaker(domain)
        resetDomains.push(domain)
        console.log(`[circuit-breaker-reset] Manual reset for domain: ${domain} by admin: ${user.email}`)
      } else {
        return NextResponse.json(
          {
            success: false,
            message: `Circuit breaker for ${domain} is not open`,
            reset: [],
          },
          { status: 400 }
        )
      }
    } else {
      // Reset all broken circuits
      const health = rateLimiter.getHealthStatus()
      for (const [domainName, domainHealth] of Object.entries(health.domains)) {
        if (domainHealth.isCircuitBroken) {
          rateLimiter.resetCircuitBreaker(domainName)
          resetDomains.push(domainName)
        }
      }

      console.log(
        `[circuit-breaker-reset] Manual reset for all domains (${resetDomains.length} circuits) by admin: ${user.email}`
      )

      if (resetDomains.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No circuit breakers are currently open",
          reset: [],
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: resetDomains.length === 1
        ? `Circuit breaker reset for ${resetDomains[0]}`
        : `Circuit breakers reset for ${resetDomains.length} domains`,
      reset: resetDomains,
    })
  } catch (error) {
    console.error("[circuit-breaker-reset] Error resetting circuit breaker:", error)
    return NextResponse.json(
      { error: "Failed to reset circuit breaker" },
      { status: 500 }
    )
  }
}
