import { SignJWT, jwtVerify } from "jose"

const TOKEN_TTL = "5m"

type LoginTokenType = "otp" | "passkey"

export async function generateLoginToken(input: {
  userId: string
  email: string
  type: LoginTokenType
}): Promise<string> {
  const secret = getSecret()

  return new SignJWT({ userId: input.userId, email: input.email, type: input.type })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secret)
}

export async function verifyLoginToken(
  token: string
): Promise<{ userId: string; email: string; type: LoginTokenType } | null> {
  try {
    const secret = getSecret()
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] })

    if (typeof payload.userId !== "string" || typeof payload.email !== "string") {
      return null
    }

    if (payload.type !== "otp" && payload.type !== "passkey") {
      return null
    }

    return { userId: payload.userId, email: payload.email, type: payload.type }
  } catch {
    return null
  }
}

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET

  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not configured")
  }

  return new TextEncoder().encode(secret)
}
