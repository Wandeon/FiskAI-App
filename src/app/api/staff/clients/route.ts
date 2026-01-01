import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (user.systemRole !== "STAFF" && user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const assignments = await db.staffAssignment.findMany({
      where: { staffId: user.id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            oib: true,
            entitlements: true,
            subscriptionStatus: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    })

    const clients = assignments.map((a) => ({
      id: a.company.id,
      name: a.company.name,
      oib: a.company.oib,
      entitlements: a.company.entitlements,
      subscriptionStatus: a.company.subscriptionStatus,
      assignedAt: a.assignedAt,
      notes: a.notes,
    }))

    return NextResponse.json(clients)
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching clients:", error)
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 })
  }
}
