import { NextRequest, NextResponse } from "next/server"
import { lookupOib, validateOib } from "@/lib/oib-lookup"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { logAudit, getIpFromHeaders, getUserAgentFromHeaders } from "@/lib/audit"

// Simple in-memory rate limiting
// In production, consider using Redis or a proper rate limiting service
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT = 10 // requests
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute in milliseconds

function checkRateLimit(identifier: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetAt) {
    // New window
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    })
    return true
  }

  if (record.count >= RATE_LIMIT) {
    return false
  }

  record.count++
  return true
}

// Clean up old entries periodically (every 5 minutes)
setInterval(
  () => {
    const now = Date.now()
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetAt) {
        rateLimitMap.delete(key)
      }
    }
  },
  5 * 60 * 1000
)

export async function POST(request: NextRequest) {
  try {
    // Authentication check - require logged-in user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      )
    }

    // Get user's company for audit logging
    const company = await getCurrentCompany(user.id)
    const companyId = company?.id

    // Use user ID for rate limiting instead of IP (per-user rate limits)
    const rateLimitKey = `oib_lookup_${user.id}`

    // Check rate limit (per-user instead of per-IP)
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        {
          success: false,
          error: "Previše zahtjeva. Pokušajte ponovno za nekoliko trenutaka.",
        },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { oib } = body

    // Validate input
    if (!oib || typeof oib !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "OIB je obavezan",
        },
        { status: 400 }
      )
    }

    // Quick format validation
    if (!validateOib(oib)) {
      return NextResponse.json(
        {
          success: false,
          error: "Neispravan format OIB-a ili kontrolna znamenka",
        },
        { status: 400 }
      )
    }

    // Perform lookup
    const result = await lookupOib(oib)

    // Log audit event for successful lookup (only if user has a company)
    if (companyId && result.success) {
      await logAudit({
        companyId,
        userId: user.id,
        action: "VIEW",
        entity: "OIB_LOOKUP",
        entityId: oib,
        changes: {
          after: {
            oib,
            businessName: result.name,
            address: result.address,
          },
        },
        ipAddress: getIpFromHeaders(request.headers),
        userAgent: getUserAgentFromHeaders(request.headers),
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("OIB lookup error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Dogodila se greška prilikom pretrage OIB-a",
      },
      { status: 500 }
    )
  }
}
