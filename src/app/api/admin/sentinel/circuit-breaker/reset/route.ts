// src/app/api/admin/sentinel/circuit-breaker/reset/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { rateLimiter } from "@/lib/regulatory-truth/utils/rate-limiter"
import { auditCircuitBreakerReset } from "@/lib/admin/circuit-breaker-audit"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const { domain, reason } = body
    const resetDomains: string[] = []
    if (domain) {
      const status = rateLimiter.getStatus(domain)
      if (status.isCircuitBroken) {
        rateLimiter.resetCircuitBreaker(domain)
        resetDomains.push(domain)
        console.log(
          "[circuit-breaker-reset] Manual reset for domain: " + domain + " by admin: " + user.email
        )
      } else {
        return NextResponse.json(
          { success: false, message: "Circuit breaker is not open", reset: [] },
          { status: 400 }
        )
      }
    } else {
      const health = rateLimiter.getHealthStatus()
      for (const [domainName, domainHealth] of Object.entries(health.domains)) {
        if (domainHealth.isCircuitBroken) {
          rateLimiter.resetCircuitBreaker(domainName)
          resetDomains.push(domainName)
        }
      }
      console.log(
        "[circuit-breaker-reset] Manual reset for all domains (" +
          resetDomains.length +
          ") by admin: " +
          user.email
      )
      if (resetDomains.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No circuit breakers are currently open",
          reset: [],
        })
      }
    }
    await auditCircuitBreakerReset({
      resetItems: resetDomains,
      adminEmail: user.email,
      adminId: user.id,
      reason,
      component: "sentinel",
      resetType: domain ? "specific" : "all",
    })
    return NextResponse.json({
      success: true,
      message: resetDomains.length + " circuit breakers have been reset",
      reset: resetDomains,
    })
  } catch (error) {
    console.error("[circuit-breaker-reset] Error:", error)
    return NextResponse.json({ error: "Failed to reset circuit breaker" }, { status: 500 })
  }
}
