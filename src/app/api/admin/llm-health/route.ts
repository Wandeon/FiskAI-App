// src/app/api/admin/llm-health/route.ts
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-utils"
import {
  pingAllProviders,
  getActiveProvider,
} from "@/lib/regulatory-truth/watchdog/llm-provider-health"
import { llmCircuitBreaker } from "@/lib/regulatory-truth/watchdog/llm-circuit-breaker"

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [pingResults, circuitStates] = await Promise.all([
      pingAllProviders(),
      llmCircuitBreaker.getAllStates(),
    ])

    const activeProvider = getActiveProvider()

    const providers = pingResults.map((ping) => {
      const circuit = circuitStates.find((c) => c.provider === ping.provider)
      return {
        ...ping,
        circuitState: circuit?.state || "CLOSED",
        consecutiveFailures: circuit?.consecutiveFailures || 0,
        isActive: ping.provider === activeProvider,
      }
    })

    return NextResponse.json({
      activeProvider,
      providers,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Failed to fetch LLM health:", error)
    return NextResponse.json({ error: "Failed to fetch LLM health" }, { status: 500 })
  }
}
