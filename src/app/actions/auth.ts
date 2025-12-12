"use server"

import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { signIn, signOut } from "@/lib/auth"
import { registerSchema, loginSchema } from "@/lib/validations"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"

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

  await db.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  })

  return { success: "Account created! Please log in." }
}

export async function login(formData: z.infer<typeof loginSchema>) {
  const validatedFields = loginSchema.safeParse(formData)

  if (!validatedFields.success) {
    return { error: "Invalid fields" }
  }

  const { email, password } = validatedFields.data

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

  redirect("/dashboard")
}

export async function logout() {
  await signOut({ redirect: false })
  redirect("/login")
}

export async function requestPasswordReset(email: string) {
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
    const crypto = await import('crypto')
    const tokenBytes = crypto.randomBytes(32)
    const token = tokenBytes.toString('hex')

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
    const resetLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${token}`
    
    const { sendEmail } = await import('@/lib/email')
    const { PasswordResetEmail } = await import('@/lib/email/templates/password-reset-email')
    
    await sendEmail({
      to: user.email,
      subject: 'Resetiranje lozinke - FiskAI',
      react: PasswordResetEmail({
        resetLink,
        userName: user.name || undefined,
      }),
    })

    return { success: true }
  } catch (error) {
    console.error('Password reset request error:', error)
    // Still return success to prevent information leakage
    return { success: true }
  }
}

export async function resetPassword(token: string, newPassword: string) {
  try {
    // Find token and validate it hasn't expired
    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      return { error: 'Token je nevažeći ili je istekao' }
    }

    if (new Date() > resetToken.expiresAt) {
      // Delete expired token
      await db.passwordResetToken.delete({
        where: { id: resetToken.id },
      })
      return { error: 'Token je istekao. Molimo zatražite novo resetiranje lozinke.' }
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

    return { success: 'Lozinka je uspješno resetirana. Možete se prijaviti s novom lozinkom.' }
  } catch (error) {
    console.error('Password reset error:', error)
    return { error: 'Došlo je do greške prilikom resetiranja lozinke' }
  }
}
