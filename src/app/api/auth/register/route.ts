import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { RegistrationIntent } from "@prisma/client"

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  registrationIntent: z.enum(["OBRT", "DRUSTVO"]),
})

export async function POST(request: Request) {
  try {
    const { email, name, password, registrationIntent } = await parseBody(request, schema)

    const emailLower = email.toLowerCase()

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email: emailLower },
    })

    if (existingUser) {
      return NextResponse.json({ error: "Email je već u upotrebi" }, { status: 400 })
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user with registrationIntent (NO Company creation during registration)
    const user = await db.user.create({
      data: {
        email: emailLower,
        name,
        passwordHash,
        registrationIntent: registrationIntent as RegistrationIntent,
        intentChosenAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Register error:", error)
    return NextResponse.json({ error: "Greška pri registraciji" }, { status: 500 })
  }
}
