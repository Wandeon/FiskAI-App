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

  // Generate verification token
  try {
    const crypto = await import("crypto")
    const tokenBytes = crypto.randomBytes(32)
    const token = tokenBytes.toString("hex")

    // Token expires in 24 hours
    const expires = new Date()
    expires.setHours(expires.getHours() + 24)

    // Delete any existing verification tokens for this email
    await db.verificationToken.deleteMany({
      where: { identifier: email },
    })

    // Create verification token
    await db.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    })

    // Send verification email
    const verifyLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/verify-email?token=${token}`
    const { sendEmail } = await import("@/lib/email")
    const { VerificationEmail } = await import("@/lib/email/templates/verification-email")

    await sendEmail({
      to: email,
      subject: "Potvrdite svoju email adresu - FiskAI",
      react: VerificationEmail({
        verifyLink,
        userName: name,
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
  const { hasMultipleRoles } = await import("@/lib/auth/system-role")
  const systemRole = user.systemRole || "USER"

  if (hasMultipleRoles(systemRole as "USER" | "STAFF" | "ADMIN")) {
    redirect("/select-role")
  }

  // Redirect to root - middleware handles routing to control-center
  redirect("/")
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
        token,
        userId: user.id,
        expiresAt,
      },
    })

    // Send password reset email
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
 * Validates a password reset token and returns a session ID.
 * This converts a one-time URL token into a secure session for password reset.
 */
export async function validatePasswordResetToken(token: string) {
  try {
    // Find token and validate it hasn't expired
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
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

    // Generate a session ID that can be used for the actual password reset
    // This prevents the token from being exposed in session storage
    const crypto = await import("crypto")
    const sessionId = crypto.randomBytes(32).toString("hex")

    // Update the token with the session ID (we'll verify this when resetting)
    await db.passwordResetToken.update({
      where: { id: resetToken.id },
      data: {
        // Store sessionId in a way we can verify later
        // We'll use the token field itself since we're converting from URL token to session
        token: sessionId,
      },
    })

    return { sessionId }
  } catch (error) {
    console.error("Token validation error:", error)
    return { error: "Došlo je do greške prilikom validacije tokena" }
  }
}

export async function resetPassword(sessionId: string, newPassword: string) {
  try {
    // Find token by session ID and validate it hasn't expired
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token: sessionId },
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

    // Delete the used token
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

    // Use signIn with a special passkey identifier
    // We need to bypass password check for passkey auth
    await signIn("credentials", {
      email: user.email,
      password: `__PASSKEY__${userId}`,
      redirect: false,
    })

    // Check if user has multiple roles and return the redirect path
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
  const identifier = `email_verification_${email.toLowerCase()}`
  const rateLimitResult = await checkRateLimit(identifier, "EMAIL_VERIFICATION")

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

    // Generate new verification token
    const crypto = await import("crypto")
    const tokenBytes = crypto.randomBytes(32)
    const token = tokenBytes.toString("hex")

    // Token expires in 24 hours
    const expires = new Date()
    expires.setHours(expires.getHours() + 24)

    // Delete any existing verification tokens for this email
    await db.verificationToken.deleteMany({
      where: { identifier: email },
    })

    // Create new verification token
    await db.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
      },
    })

    // Send verification email
    const verifyLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/verify-email?token=${token}`
    const { sendEmail } = await import("@/lib/email")
    const { VerificationEmail } = await import("@/lib/email/templates/verification-email")

    await sendEmail({
      to: email,
      subject: "Potvrdite svoju email adresu - FiskAI",
      react: VerificationEmail({
        verifyLink,
        userName: user.name || undefined,
      }),
    })

    return { success: true }
  } catch (error) {
    console.error("Resend verification email error:", error)
    // Return success to prevent information leakage
    return { success: true }
  }
}
