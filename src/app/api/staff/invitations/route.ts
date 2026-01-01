import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { addDays } from "date-fns"
import { sendEmail } from "@/lib/email"
import ClientInvitation from "@/emails/client-invitation"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { createInvitationSchema } from "../_schemas"

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
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching invitations:", error)
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 })
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

    const { email, companyName, message } = await parseBody(request, createInvitationSchema)

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
        return NextResponse.json({ error: "This user is already your client" }, { status: 409 })
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

    // Send invitation email using Resend
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"
    const invitationUrl = `${baseUrl}/accept-invitation?token=${invitation.token}`

    const emailResult = await sendEmail({
      to: email,
      subject: "Poziv u FiskAI platformu",
      react: ClientInvitation({
        invitationUrl,
        staffName: session.user.name || "Vas racunovoda",
        message,
      }),
    })

    if (!emailResult.success) {
      console.error("Failed to send invitation email:", emailResult.error)
      // Still return success since the invitation was created
      // The user can manually share the link if needed
    }

    console.log(`Invitation created for ${email} (ID: ${invitation.id})`)

    return NextResponse.json(invitation, { status: 201 })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error creating invitation:", error)
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 })
  }
}
