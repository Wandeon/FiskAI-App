import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { z } from "zod"

const createAssignmentSchema = z.object({
  staffId: z.string().min(1),
  companyId: z.string().min(1),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const assignments = await db.staffAssignment.findMany({
    include: {
      staff: {
        select: { id: true, name: true, email: true },
      },
      company: {
        select: { id: true, name: true, oib: true },
      },
      assigner: {
        select: { id: true, name: true },
      },
    },
    orderBy: { assignedAt: "desc" },
  })

  return NextResponse.json(assignments)
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()

  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createAssignmentSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors }, { status: 400 })
  }

  const { staffId, companyId, notes } = parsed.data

  // Verify staff user exists and has STAFF role
  const staffUser = await db.user.findUnique({
    where: { id: staffId },
    select: { systemRole: true },
  })

  if (!staffUser || staffUser.systemRole !== "STAFF") {
    return NextResponse.json({ error: "Invalid staff user" }, { status: 400 })
  }

  // Verify company exists
  const company = await db.company.findUnique({
    where: { id: companyId },
  })

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  // Check for duplicate assignments
  const existing = await db.staffAssignment.findUnique({
    where: {
      staffId_companyId: { staffId, companyId },
    },
  })

  if (existing) {
    return NextResponse.json({ error: "Assignment already exists" }, { status: 409 })
  }

  const assignment = await db.staffAssignment.create({
    data: {
      staffId,
      companyId,
      assignedBy: user.id,
      notes,
    },
    include: {
      staff: {
        select: { id: true, name: true, email: true },
      },
      company: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json(assignment, { status: 201 })
}
