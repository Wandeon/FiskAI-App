import { SignJWT, jwtVerify } from "jose"

/**
 * Generate a cryptographically secure unsubscribe token
 * @param email - The subscriber's email address
 * @returns A signed JWT token that expires in 30 days
 */
export async function generateUnsubscribeToken(email: string): Promise<string> {
  const secret = getUnsubscribeSecret()

  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(secret)

  return token
}

/**
 * Verify and decode an unsubscribe token
 * @param token - The JWT token to verify
 * @returns The email address if valid, null if invalid or expired
 */
export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  try {
    const secret = getUnsubscribeSecret()

    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    })

    // Validate that the payload contains an email
    if (typeof payload.email !== "string" || !payload.email) {
      return null
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(payload.email)) {
      return null
    }

    return payload.email
  } catch (error) {
    // Token is invalid, expired, or malformed
    console.error("Unsubscribe token verification failed:", error)
    return null
  }
}

/**
 * Get the unsubscribe secret from environment variables
 * @returns The secret as a Uint8Array for jose
 */
function getUnsubscribeSecret(): Uint8Array {
  const secret = process.env.UNSUBSCRIBE_SECRET

  if (!secret) {
    throw new Error(
      "UNSUBSCRIBE_SECRET is not configured. Please set it in your .env file. Generate with: openssl rand -hex 32"
    )
  }

  return new TextEncoder().encode(secret)
}
