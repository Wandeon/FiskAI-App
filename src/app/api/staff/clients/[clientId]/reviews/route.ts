import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getCurrentUser } from "@/lib/auth-utils"
import { z } from "zod"
import { StaffReviewEntity } from "@prisma/client"

const toggleReviewSchema = z.object({
  entityType: z.enum(["EINVOICE", "EXPENSE", "DOCUMENT"]),
  entityId: z.string().min(1),
  reviewed: z.boolean(),
  notes: z.string().optional(),
})

// GET - List all reviews for a client
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

  const searchParams = request.nextUrl.searchParams
  const entityType = searchParams.get("entityType") as StaffReviewEntity | null
  const entityIds = searchParams.get("entityIds")?.split(",") || []

  const reviews = await db.staffReview.findMany({
    where: {
      companyId: clientId,
      ...(entityType && { entityType }),
      ...(entityIds.length > 0 && { entityId: { in: entityIds } }),
    },
    include: {
      reviewer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { reviewedAt: "desc" },
  })

  return NextResponse.json(reviews)
}

// POST - Toggle review status for an entity
export async function POST(
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

  const body = await request.json()
  const validation = toggleReviewSchema.safeParse(body)

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request", details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { entityType, entityId, reviewed, notes } = validation.data

  // Verify the entity exists and belongs to this company
  let entityExists = false
  switch (entityType) {
    case "EINVOICE":
      entityExists = !!(await db.eInvoice.findFirst({
        where: { id: entityId, companyId: clientId },
      }))
      break
    case "EXPENSE":
      entityExists = !!(await db.expense.findFirst({
        where: { id: entityId, companyId: clientId },
      }))
      break
    case "DOCUMENT":
      entityExists = !!(await db.document.findFirst({
        where: { id: entityId, companyId: clientId },
      }))
      break
  }

  if (!entityExists) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 })
  }

  if (reviewed) {
    // Mark as reviewed
    const review = await db.staffReview.upsert({
      where: {
        companyId_entityType_entityId: {
          companyId: clientId,
          entityType: entityType as StaffReviewEntity,
          entityId,
        },
      },
      update: {
        reviewerId: user.id,
        reviewedAt: new Date(),
        notes,
      },
      create: {
        companyId: clientId,
        reviewerId: user.id,
        entityType: entityType as StaffReviewEntity,
        entityId,
        notes,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: clientId,
        userId: user.id,
        action: "STAFF_REVIEW_MARKED",
        entity: entityType,
        entityId,
        changes: { notes },
      },
    })

    return NextResponse.json(review)
  } else {
    // Remove review
    await db.staffReview.deleteMany({
      where: {
        companyId: clientId,
        entityType: entityType as StaffReviewEntity,
        entityId,
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        companyId: clientId,
        userId: user.id,
        action: "STAFF_REVIEW_UNMARKED",
        entity: entityType,
        entityId,
      },
    })

    return NextResponse.json({ success: true })
  }
}
