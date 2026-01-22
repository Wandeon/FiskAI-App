// src/app/api/health/intelligence/route.ts
/**
 * Intelligence API Health Check
 *
 * Returns the status of the Intelligence API connection.
 * Used by monitoring systems to verify regulatory data access.
 */

import { NextResponse } from "next/server"
import { getIntelligenceStatus } from "@/lib/intelligence"

export async function GET() {
  const status = await getIntelligenceStatus()

  const httpStatus = status.configured && status.reachable ? 200 : status.configured ? 503 : 424

  // Debug: check if env vars are present
  const hasBaseUrl = Boolean(process.env.INTELLIGENCE_API_BASE_URL)
  const hasToken = Boolean(process.env.INTELLIGENCE_API_TOKEN)

  return NextResponse.json(
    {
      service: "intelligence",
      configured: status.configured,
      reachable: status.reachable,
      status: status.status ?? null,
      error: status.error ?? null,
      timestamp: new Date().toISOString(),
      _debug: {
        hasBaseUrl,
        hasToken,
        baseUrlLength: process.env.INTELLIGENCE_API_BASE_URL?.length ?? 0,
        tokenLength: process.env.INTELLIGENCE_API_TOKEN?.length ?? 0,
      },
    },
    { status: httpStatus }
  )
}
