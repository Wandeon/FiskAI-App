"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { signIn, signOut } from "@/lib/auth"
import { registerSchema, loginSchema } from "@/lib/validations"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"
import { checkRateLimit } from "@/lib/security/rate-limit"

export async function register(formData: z.infer<typeof registerSchema>) {
  const validatedFields = registerSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields" }
  }

  const { name, email, password } = validatedFields.data

  const existingUser = await db.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    return { error: "Email already in use" }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  })

  // Generate verification OTP code (modern flow)
  try {
    const { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } = await import("@/lib/auth/otp")

    // Delete any existing verification codes for this email
    await db.verificationCode.deleteMany({
      where: {
        email: email.toLowerCase(),
        type: "EMAIL_VERIFY",
      },
    })

    // Generate and hash OTP
    const code = generateOTP()
    const codeHash = await hashOTP(code)

    // Calculate expiry
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES)

    // Create verification code record
    await db.verificationCode.create({
      data: {
        email: email.toLowerCase(),
        userId: user.id,
        codeHash,
        type: "EMAIL_VERIFY",
        expiresAt,
      },
    })

    // Send OTP email
    const { sendEmail } = await import("@/lib/email")
    const { OTPCodeEmail } = await import("@/lib/email/templates/otp-code-email")

    await sendEmail({
      to: email,
      subject: "Vaš FiskAI verifikacijski kod",
      react: OTPCodeEmail({
        code,
        userName: name,
        type: "verify",
      }),
    })
  } catch (emailError) {
    // Don't fail registration if email fails, but log it
    console.error("Failed to send verification email:", emailError)
  }

  return { success: true, email }
}

export async function login(formData: z.infer<typeof loginSchema>) {
  const validatedFields = loginSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields" }
  }

  const { email, password } = validatedFields.data

  // Rate limiting for login attempts
  const identifier = `login_${email.toLowerCase()}`
  const rateLimitResult = await checkRateLimit(identifier, "LOGIN")

  if (!rateLimitResult.allowed) {
    // Don't reveal that account exists or rate limit status
    return { error: "Invalid credentials" }
  }

  // Check if user exists and verify password before checking email verification
  const user = await db.user.findUnique({
    where: { email },
  })

  if (!user || !user.passwordHash) {
    return { error: "Invalid credentials" }
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) {
    return { error: "Invalid credentials" }
  }

  // Check if email is verified
  if (!user.emailVerified) {
    return { error: "email_not_verified", email: user.email }
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "Invalid credentials" }
        default:
          return { error: "Something went wrong" }
      }
    }
    throw error
  }

  // Check if user has multiple roles and redirect accordingly
  // STAFF and ADMIN see role selection page (can access multiple portals)
  // Regular users go directly to their dashboard (only one portal access)
  const { hasMultipleRoles } = await import("@/lib/auth/system-role")
  const systemRole = user.systemRole || "USER"

  if (hasMultipleRoles(systemRole as "USER" | "STAFF" | "ADMIN")) {
    redirect("/select-role")
  }

  redirect("/dashboard")
}

export async function logout() {
  await signOut({ redirect: false })
  redirect("/login")
}

export async function requestPasswordReset(email: string) {
  // Rate limiting for password reset attempts
  const identifier = `password_reset_${email.toLowerCase()}`
  const rateLimitResult = await checkRateLimit(identifier, "PASSWORD_RESET")

  if (!rateLimitResult.allowed) {
    // Always return success to prevent information leakage and rate limit detection
    return { success: true }
  }

  try {
    // Always return success to prevent email enumeration
    const user = await db.user.findUnique({
      where: { email },
    })

    if (!user) {
      // Return success even if user doesn't exist
      return { success: true }
    }

    // Generate secure random token
    const crypto = await import("crypto")
    const tokenBytes = crypto.randomBytes(32)
    const token = tokenBytes.toString("hex")
    // Hash the token before storing (security: prevent token reuse if DB is compromised)
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    // Token expires in 1 hour
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    // Delete any existing reset tokens for this user
    await db.passwordResetToken.deleteMany({
      where: { userId: user.id },
    })

    // Create new reset token
    await db.passwordResetToken.create({
      data: {
        token: tokenHash, // Store hash, not plain token
        userId: user.id,
        expiresAt,
      },
    })

    // Send password reset email with plain token (only sent once, never stored)
    const resetLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`

    const { sendEmail } = await import("@/lib/email")
    const { PasswordResetEmail } = await import("@/lib/email/templates/password-reset-email")

    await sendEmail({
      to: user.email,
      subject: "Resetiranje lozinke - FiskAI",
      react: PasswordResetEmail({
        resetLink,
        userName: user.name || undefined,
      }),
    })

    return { success: true }
  } catch (error) {
    console.error("Password reset request error:", error)
    // Still return success to prevent information leakage
    return { success: true }
  }
}

/**
 * Validates a password reset token and returns a session identifier
 * This prevents the token from being exposed in URL query parameters
 */
export async function validatePasswordResetToken(token: string) {
  try {
    // Hash the submitted token to compare with stored hash
    const crypto = await import("crypto")
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    // Find token and validate it hasn't expired
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token: tokenHash },
      include: { user: true },
    })

    if (!resetToken) {
      return { error: "Token je nevažeći ili je istekao" }
    }

    if (new Date() > resetToken.expiresAt) {
      // Delete expired token
      await db.passwordResetToken.delete({
        where: { id: resetToken.id },
      })
      return { error: "Token je istekao. Molimo zatražite novo resetiranje lozinke." }
    }

    // Generate a secure session identifier
    const sessionId = crypto.randomBytes(32).toString("hex")
    const sessionHash = crypto.createHash("sha256").update(sessionId).digest("hex")

    // Store the session ID hash in the token record (we'll use it to validate the reset)
    // We don't delete the token yet - we'll delete it when password is actually reset
    // This creates a short-lived, one-time-use session
    await db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: {
        // Store session ID hash in the token field temporarily
        // The original token is no longer valid after this point
        token: sessionHash,
      },
    })

    return {
      success: true,
      sessionId,
      userId: resetToken.userId,
    }
  } catch (error) {
    console.error("Password reset token validation error:", error)
    return { error: "Došlo je do greške prilikom validacije tokena" }
  }
}

/**
 * Resets password using a validated session ID (not the original token)
 */
export async function resetPassword(sessionId: string, newPassword: string) {
  try {
    // Hash the session ID to compare with stored hash
    const crypto = await import("crypto")
    const sessionHash = crypto.createHash("sha256").update(sessionId).digest("hex")

    // Find the session by the session ID hash (which is now stored in the token field)
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token: sessionHash },
      include: { user: true },
    })

    if (!resetToken) {
      return { error: "Sesija je nevažeća ili je istekla" }
    }

    if (new Date() > resetToken.expiresAt) {
      // Delete expired token
      await db.passwordResetToken.delete({
        where: { id: resetToken.id },
      })
      return { error: "Sesija je istekla. Molimo zatražite novo resetiranje lozinke." }
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Update user's password
    await db.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    })

    // Delete the used token/session
    await db.passwordResetToken.delete({
      where: { id: resetToken.id },
    })

    return { success: "Lozinka je uspješno resetirana. Možete se prijaviti s novom lozinkom." }
  } catch (error) {
    console.error("Password reset error:", error)
    return { error: "Došlo je do greške prilikom resetiranja lozinke" }
  }
}

export async function loginWithPasskey(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, systemRole: true },
    })

    if (!user) {
      return { error: "Korisnik nije pronađen" }
    }

    const { generateLoginToken } = await import("@/lib/auth/login-token")
    const loginToken = await generateLoginToken({
      userId: user.id,
      email: user.email,
      type: "passkey",
    })

    await signIn("credentials", {
      email: user.email,
      loginToken,
      redirect: false,
    })

    // Check if user has multiple roles and return the redirect path
    // STAFF and ADMIN see role selection page (can access multiple portals)
    // Regular users go directly to their dashboard (only one portal access)
    const { hasMultipleRoles } = await import("@/lib/auth/system-role")
    const systemRole = user.systemRole || "USER"

    const redirectPath = hasMultipleRoles(systemRole as "USER" | "STAFF" | "ADMIN")
      ? "/select-role"
      : "/dashboard"

    return { success: true, redirect: redirectPath }
  } catch (error) {
    console.error("Passkey login error:", error)
    if (error instanceof AuthError) {
      return { error: "Greška pri prijavi" }
    }
    throw error
  }
}

/**
 * Legacy email verification via token links (backwards compatibility)
 *
 * Modern flow uses OTP codes via /api/auth/verify-code
 * This function remains to support old verification links that may still be in users' inboxes
 */
export async function verifyEmail(token: string) {
  try {
    // Find the verification token
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    })

    if (!verificationToken) {
      return { error: "invalid_token" }
    }

    // Check if token is expired
    if (new Date() > verificationToken.expires) {
      // Delete expired token
      await db.verificationToken.delete({
        where: { token },
      })
      return { error: "token_expired", email: verificationToken.identifier }
    }

    // Find the user by email (identifier)
    const user = await db.user.findUnique({
      where: { email: verificationToken.identifier },
    })

    if (!user) {
      return { error: "user_not_found" }
    }

    // Check if already verified
    if (user.emailVerified) {
      // Delete the token since it's no longer needed
      await db.verificationToken.delete({
        where: { token },
      })
      return { success: true, alreadyVerified: true }
    }

    // Update user's emailVerified field
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    })

    // Delete the used token
    await db.verificationToken.delete({
      where: { token },
    })

    return { success: true }
  } catch (error) {
    console.error("Email verification error:", error)
    return { error: "verification_failed" }
  }
}

export async function resendVerificationEmail(email: string) {
  // Rate limiting for verification email resend
  const identifier = `otp_send_${email.toLowerCase()}`
  const rateLimitResult = await checkRateLimit(identifier, "OTP_SEND")

  if (!rateLimitResult.allowed) {
    return { error: "rate_limited" }
  }

  try {
    // Find the user
    const user = await db.user.findUnique({
      where: { email },
    })

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true }
    }

    // If already verified, return success (don't reveal verification status)
    if (user.emailVerified) {
      return { success: true }
    }

    // Generate and send OTP code (modern flow)
    const { generateOTP, hashOTP, OTP_EXPIRY_MINUTES } = await import("@/lib/auth/otp")

    // Delete any existing verification codes for this email
    await db.verificationCode.deleteMany({
      where: {
        email: email.toLowerCase(),
        type: "EMAIL_VERIFY",
      },
    })

    // Generate and hash OTP
    const code = generateOTP()
    const codeHash = await hashOTP(code)

    // Calculate expiry
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES)

    // Create verification code record
    await db.verificationCode.create({
      data: {
        email: email.toLowerCase(),
        userId: user.id,
        codeHash,
        type: "EMAIL_VERIFY",
        expiresAt,
      },
    })

    // Send OTP email
    const { sendEmail } = await import("@/lib/email")
    const { OTPCodeEmail } = await import("@/lib/email/templates/otp-code-email")

    await sendEmail({
      to: email,
      subject: "Vaš FiskAI verifikacijski kod",
      react: OTPCodeEmail({
        code,
        userName: user.name || undefined,
        type: "verify",
      }),
    })

    return { success: true }
  } catch (error) {
    console.error("Resend verification email error:", error)
    // Return success to prevent information leakage
    return { success: true }
  }
}
