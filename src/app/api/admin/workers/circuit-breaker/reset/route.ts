// src/app/api/admin/workers/circuit-breaker/reset/route.ts

import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import {
  resetCircuitBreaker,
  resetAllCircuitBreakers,
  getCircuitBreakerStatus,
} from "@/lib/regulatory-truth/workers/circuit-breaker"
import { auditCircuitBreakerReset } from "@/lib/admin/circuit-breaker-audit"

/**
 * POST /api/admin/workers/circuit-breaker/reset
 *
 * Manually reset circuit breaker for worker operations (opossum-based breakers).
 * This allows administrators to override automatic timeouts and immediately
 * restore worker operations after transient issues are resolved.
 *
 * Request body:
 * - name (optional): Specific circuit breaker to reset. If omitted, resets all open breakers.
 * - reason (optional): Reason for the manual reset (for audit trail).
 *
 * Response:
 * - success: boolean
 * - message: string
 * - reset: string[] - list of circuit breakers that were reset
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
    const { name, reason } = body

    let resetBreakers: string[] = []

    if (name) {
      // Reset specific circuit breaker
      const status = getCircuitBreakerStatus()
      if (!status[name]) {
        return NextResponse.json(
          {
            success: false,
            message: `Circuit breaker '${name}' not found`,
            reset: [],
          },
          { status: 404 }
        )
      }

      if (status[name].state === "closed") {
        return NextResponse.json(
          {
            success: false,
            message: `Circuit breaker '${name}' is already closed`,
            reset: [],
          },
          { status: 400 }
        )
      }

      const success = resetCircuitBreaker(name)
      if (success) {
        resetBreakers = [name]
        console.log(`[workers-circuit-breaker-reset] Manual reset for: ${name} by admin: ${user.email}`)
      }
    } else {
      // Reset all open circuit breakers
      resetBreakers = resetAllCircuitBreakers()
      console.log(
        `[workers-circuit-breaker-reset] Manual reset for all breakers (${resetBreakers.length} circuits) by admin: ${user.email}`
      )

      if (resetBreakers.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No circuit breakers are currently open",
          reset: [],
        })
      }
    }

    // Audit log and notify ops team (Issue #835)
    await auditCircuitBreakerReset({
      resetItems: resetBreakers,
      adminEmail: user.email,
      adminId: user.id,
      reason,
      component: "worker",
      resetType: name ? "specific" : "all",
    })

    return NextResponse.json({
      success: true,
      message: resetBreakers.length === 1
        ? `Circuit breaker '${resetBreakers[0]}' has been reset`
        : `${resetBreakers.length} circuit breakers have been reset`,
      reset: resetBreakers,
    })
  } catch (error) {
    console.error("[workers-circuit-breaker-reset] Error resetting circuit breaker:", error)
    return NextResponse.json(
      { error: "Failed to reset circuit breaker" },
      { status: 500 }
    )
  }
}
