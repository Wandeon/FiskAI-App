// Staff API rate limiting helper
import { NextResponse } from "next/server"
import { checkRateLimit } from "./rate-limit"

/**
 * Check rate limit for staff API endpoints
 * Returns a 429 response if rate limit is exceeded, otherwise returns null
 */
export async function checkStaffRateLimit(
  userId: string,
  limitType: "STAFF_API" | "STAFF_BULK_EXPORT" = "STAFF_API"
): Promise<NextResponse | null> {
  const rateLimitResult = await checkRateLimit(userId, limitType)

  if (!rateLimitResult.allowed) {
    const retryAfter = rateLimitResult.resetAt
      ? String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000))
      : limitType === "STAFF_BULK_EXPORT"
        ? "3600"
        : "60"

    const message =
      limitType === "STAFF_BULK_EXPORT"
        ? "Too many requests. Bulk exports are limited to prevent data extraction."
        : "Too many requests"

    return NextResponse.json(
      { error: message },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter,
        },
      }
    )
  }

  return null
}
