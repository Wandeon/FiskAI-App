import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"
import bcrypt from "bcryptjs"

const acceptInvitationSchema = z.object({
  token: z.string(),
  name: z.string().min(2, "Ime mora imati najmanje 2 znaka"),
  password: z.string().min(8, "Lozinka mora imati najmanje 8 znakova"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = acceptInvitationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 })
    }

    const { token, name, password } = validation.data

    // Find the invitation
    const invitation = await db.clientInvitation.findUnique({
      where: { token },
      include: {
        staff: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: "Poziv nije pronađen" }, { status: 404 })
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Poziv je istekao. Molimo zatražite novi poziv." },
        { status: 410 }
      )
    }

    // Check if invitation is not pending
    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Ovaj poziv je već prihvaćen ili otkazan" },
        { status: 409 }
      )
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: invitation.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "Korisnik s ovim emailom već postoji. Prijavite se." },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create the user and company in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          name,
          passwordHash: hashedPassword,
          systemRole: "USER",
        },
      })

      // Create company if companyName was provided (minimal, user completes in onboarding)
      let company = null
      if (invitation.companyName) {
        // Generate a placeholder OIB that must be updated during onboarding
        const placeholderOib = `PENDING_${Date.now()}`
        company = await tx.company.create({
          data: {
            name: invitation.companyName,
            oib: placeholderOib,
            address: "",
            city: "",
            postalCode: "",
            country: "HR",
            entitlements: ["invoicing", "contacts", "products", "expenses"],
          },
        })

        // Add user to company
        await tx.companyUser.create({
          data: {
            userId: user.id,
            companyId: company.id,
            role: "OWNER",
          },
        })

        // Create staff assignment
        await tx.staffAssignment.create({
          data: {
            staffId: invitation.staffId,
            companyId: company.id,
            assignedBy: invitation.staffId, // Staff member assigned themselves via invitation
          },
        })

        // Update invitation with company ID
        await tx.clientInvitation.update({
          where: { id: invitation.id },
          data: {
            companyId: company.id,
          },
        })
      }

      // Mark invitation as accepted
      await tx.clientInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
      })

      return { user, company }
    })

    return NextResponse.json(
      {
        success: true,
        message: "Poziv uspješno prihvaćen. Možete se prijaviti.",
        userId: result.user.id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error accepting invitation:", error)
    return NextResponse.json({ error: "Greška prilikom prihvaćanja poziva" }, { status: 500 })
  }
}
