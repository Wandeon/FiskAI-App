import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { addDays } from "date-fns"

const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  companyName: z.string().optional(),
  message: z.string().optional(),
})

// GET - List invitations for current staff
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is staff
    if (session.user.systemRole !== "STAFF" && session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const invitations = await db.clientInvitation.findMany({
      where: { staffId: session.user.id },
      include: {
        company: {
          select: { id: true, name: true, oib: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(invitations)
  } catch (error) {
    console.error("Error fetching invitations:", error)
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    )
  }
}

// POST - Create new invitation
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user is staff
    if (session.user.systemRole !== "STAFF" && session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validation = createInvitationSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      )
    }

    const { email, companyName, message } = validation.data

    // Check if there's already a pending invitation for this email from this staff
    const existingInvitation = await db.clientInvitation.findFirst({
      where: {
        staffId: session.user.id,
        email,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    })

    if (existingInvitation) {
      return NextResponse.json(
        { error: "A pending invitation already exists for this email" },
        { status: 409 }
      )
    }

    // Check if email is already registered as a user
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      // Check if already a client of this staff
      const existingAssignment = await db.staffAssignment.findFirst({
        where: {
          staffId: session.user.id,
          company: {
            users: {
              some: { userId: existingUser.id },
            },
          },
        },
      })

      if (existingAssignment) {
        return NextResponse.json(
          { error: "This user is already your client" },
          { status: 409 }
        )
      }
    }

    // Create the invitation (expires in 7 days)
    const invitation = await db.clientInvitation.create({
      data: {
        staffId: session.user.id,
        email,
        companyName,
        message,
        expiresAt: addDays(new Date(), 7),
      },
    })

    // TODO: Send invitation email using Resend
    // For now, just log the invitation token
    console.log(`Invitation created for ${email} with token: ${invitation.token}`)

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    console.error("Error creating invitation:", error)
    return NextResponse.json(
      { error: "Failed to create invitation" },
      { status: 500 }
    )
  }
}
