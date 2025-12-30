import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (user.systemRole !== "STAFF" && user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { clientId } = await params

  // Verify staff is assigned to this company (unless they're ADMIN)
  if (user.systemRole !== "ADMIN") {
    const assignment = await db.staffAssignment.findUnique({
      where: {
        staffId_companyId: {
          staffId: user.id,
          companyId: clientId,
        },
      },
    })

    if (!assignment) {
      return NextResponse.json({ error: "Not assigned to this client" }, { status: 403 })
    }
  }

  const company = await db.company.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      oib: true,
      vatNumber: true,
      address: true,
      city: true,
      postalCode: true,
      email: true,
      phone: true,
      entitlements: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      legalForm: true,
      isVatPayer: true,
    },
  })

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  return NextResponse.json(company)
}
