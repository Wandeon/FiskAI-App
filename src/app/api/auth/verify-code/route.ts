// src/app/api/auth/verify-code/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import { verifyOTP } from "@/lib/auth/otp"
import { checkRateLimit, resetRateLimit } from "@/lib/security/rate-limit"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  type: z.enum(["EMAIL_VERIFY", "PASSWORD_RESET", "LOGIN_VERIFY"]),
})

export async function POST(request: Request) {
  try {
    const { email, code, type } = await parseBody(request, schema)

    const emailLower = email.toLowerCase()

    // Rate limit check for verification attempts
    const rateLimitKey = `otp_verify_${emailLower}`
    const rateLimit = await checkRateLimit(rateLimitKey, "OTP_VERIFY")

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Previše pokušaja. Pokušajte ponovno za 30 minuta." },
        { status: 429 }
      )
    }

    // Find the verification code
    const verificationCode = await db.verificationCode.findFirst({
      where: {
        email: emailLower,
        type,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    })

    if (!verificationCode) {
      return NextResponse.json({ error: "Kod je istekao ili ne postoji" }, { status: 400 })
    }

    // Check attempts
    if (verificationCode.attempts >= 5) {
      await db.verificationCode.delete({
        where: { id: verificationCode.id },
      })
      return NextResponse.json(
        { error: "Previše neuspjelih pokušaja. Zatražite novi kod." },
        { status: 400 }
      )
    }

    // Verify the code
    const isValid = await verifyOTP(code, verificationCode.codeHash)

    if (!isValid) {
      // Increment attempts
      await db.verificationCode.update({
        where: { id: verificationCode.id },
        data: { attempts: { increment: 1 } },
      })

      const remainingAttempts = 5 - verificationCode.attempts - 1
      return NextResponse.json(
        {
          error: `Neispravan kod. Preostalo pokušaja: ${remainingAttempts}`,
          remainingAttempts,
        },
        { status: 400 }
      )
    }

    // Code is valid - delete it and process based on type
    await db.verificationCode.delete({
      where: { id: verificationCode.id },
    })

    // Reset rate limits on success
    resetRateLimit(rateLimitKey)
    resetRateLimit(`otp_send_${emailLower}`)

    if (type === "EMAIL_VERIFY") {
      // Mark email as verified
      const user = await db.user.update({
        where: { email: emailLower },
        data: { emailVerified: new Date() },
        select: { id: true, systemRole: true },
      })

      const { generateLoginToken } = await import("@/lib/auth/login-token")
      const loginToken = await generateLoginToken({
        userId: user.id,
        email: emailLower,
        type: "otp",
      })

      return NextResponse.json({
        success: true,
        verified: true,
        loginToken,
        systemRole: user.systemRole,
      })
    }

    if (type === "LOGIN_VERIFY") {
      // Return success - client will handle session creation
      const user = await db.user.findUnique({
        where: { email: emailLower },
        select: { id: true, systemRole: true },
      })

      if (!user) {
        return NextResponse.json({ error: "Korisnik nije pronađen" }, { status: 404 })
      }

      const { generateLoginToken } = await import("@/lib/auth/login-token")
      const loginToken = await generateLoginToken({
        userId: user.id,
        email: emailLower,
        type: "otp",
      })

      return NextResponse.json({
        success: true,
        verified: true,
        loginToken,
        systemRole: user.systemRole,
      })
    }

    if (type === "PASSWORD_RESET") {
      // Generate a short-lived token for password reset form
      const crypto = await import("crypto")
      const resetToken = crypto.randomBytes(32).toString("hex")
      // Hash the token before storing (security: prevent token reuse if DB is compromised)
      const tokenHash = crypto.createHash("sha256").update(resetToken).digest("hex")

      const user = await db.user.findUnique({
        where: { email: emailLower },
      })

      if (user) {
        // Clean up old tokens
        await db.passwordResetToken.deleteMany({
          where: { userId: user.id },
        })

        // Create new token (expires in 15 minutes after OTP verification)
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 15)

        await db.passwordResetToken.create({
          data: {
            token: tokenHash, // Store hash, not plain token
            userId: user.id,
            expiresAt,
          },
        })
      }

      return NextResponse.json({
        success: true,
        verified: true,
        resetToken, // Return plain token to client (only once, never stored)
      })
    }

    return NextResponse.json({ success: true, verified: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Verify code error:", error)
    return NextResponse.json({ error: "Greška pri verifikaciji" }, { status: 500 })
  }
}
