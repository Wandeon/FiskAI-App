import { NextRequest, NextResponse } from "next/server"
import { lookupOib, validateOib } from "@/lib/oib-lookup"

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
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}, 5 * 60 * 1000)

export async function POST(request: NextRequest) {
  try {
    // Get IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || 
               request.headers.get("x-real-ip") || 
               "unknown"

    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Previše zahtjeva. Pokušajte ponovno za nekoliko trenutaka." 
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
          error: "OIB je obavezan" 
        },
        { status: 400 }
      )
    }

    // Quick format validation
    if (!validateOib(oib)) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Neispravan format OIB-a ili kontrolna znamenka" 
        },
        { status: 400 }
      )
    }

    // Perform lookup
    const result = await lookupOib(oib)

    return NextResponse.json(result)
  } catch (error) {
    console.error("OIB lookup error:", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Dogodila se greška prilikom pretrage OIB-a" 
      },
      { status: 500 }
    )
  }
}
