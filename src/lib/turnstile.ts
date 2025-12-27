/**
 * Server-side Cloudflare Turnstile verification
 *
 * Turnstile provides invisible bot protection for forms.
 * This module handles server-side token verification.
 */

interface TurnstileVerifyResponse {
  success: boolean
  "error-codes"?: string[]
  challenge_ts?: string
  hostname?: string
}

/**
 * Verify a Turnstile token server-side
 *
 * @param token - The token from the client-side widget
 * @param ip - The client IP address (from request headers)
 * @returns true if verification succeeds, false otherwise
 *
 * @example
 * ```ts
 * const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? ''
 * const isValid = await verifyTurnstileToken(token, ip)
 * if (!isValid) {
 *   return { error: 'Bot verification failed' }
 * }
 * ```
 */
export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY

  if (!secretKey) {
    // Only fail open in development to allow testing without Turnstile
    // In production, fail closed for security
    if (process.env.NODE_ENV === "development") {
      console.warn("TURNSTILE_SECRET_KEY not configured - allowing in development")
      return true
    }
    console.error("TURNSTILE_SECRET_KEY not configured in production - rejecting request")
    return false
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: ip,
      }),
    })

    const data: TurnstileVerifyResponse = await response.json()

    if (!data.success && data["error-codes"]) {
      console.warn("Turnstile verification failed:", data["error-codes"].join(", "))
    }

    return data.success === true
  } catch (error) {
    console.error("Turnstile verification error:", error)
    // Fail closed on network errors in production
    return false
  }
}

/**
 * Extract client IP from request headers
 * Handles Cloudflare and standard proxy headers
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    ""
  )
}
