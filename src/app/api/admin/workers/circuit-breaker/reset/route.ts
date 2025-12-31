// src/app/api/admin/workers/circuit-breaker/reset/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import {
  resetCircuitBreaker,
  resetAllCircuitBreakers,
  getCircuitBreakerStatus,
} from "@/lib/regulatory-truth/workers/circuit-breaker"
import { auditCircuitBreakerReset } from "@/lib/admin/circuit-breaker-audit"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const { name, reason } = body
    let resetBreakers: string[] = []
    if (name) {
      const status = getCircuitBreakerStatus()
      if (!status[name]) {
        return NextResponse.json(
          { success: false, message: "Circuit breaker not found", reset: [] },
          { status: 404 }
        )
      }
      if (status[name].state === "closed") {
        return NextResponse.json(
          { success: false, message: "Circuit breaker is already closed", reset: [] },
          { status: 400 }
        )
      }
      const success = resetCircuitBreaker(name)
      if (success) {
        resetBreakers = [name]
        console.log(
          "[workers-circuit-breaker-reset] Manual reset for: " + name + " by admin: " + user.email
        )
      }
    } else {
      resetBreakers = resetAllCircuitBreakers()
      console.log(
        "[workers-circuit-breaker-reset] Manual reset for all breakers (" +
          resetBreakers.length +
          ") by admin: " +
          user.email
      )
      if (resetBreakers.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No circuit breakers are currently open",
          reset: [],
        })
      }
    }
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
      message: resetBreakers.length + " circuit breakers have been reset",
      reset: resetBreakers,
    })
  } catch (error) {
    console.error("[workers-circuit-breaker-reset] Error:", error)
    return NextResponse.json({ error: "Failed to reset circuit breaker" }, { status: 500 })
  }
}
