import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { ConflictsView } from "./conflicts-view"

export const revalidate = 0 // Always fetch fresh data

interface SearchParams {
  status?: string
  page?: string
}

export default async function RegulatoryConflictsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()

  if (!user || user.systemRole !== "ADMIN") {
    redirect("/dashboard")
  }

  const params = await searchParams
  const statusFilter = params.status as "OPEN" | "RESOLVED" | "ESCALATED" | undefined
  const page = parseInt(params.page || "1", 10)
  const pageSize = 20

  // Get conflicts
  const where: any = {}

  if (statusFilter) {
    where.status = statusFilter
  } else {
    // Default to open conflicts
    where.status = { in: ["OPEN"] }
  }

  const [conflicts, total] = await Promise.all([
    db.regulatoryConflict.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        itemA: {
          include: {
            sourcePointers: {
              include: {
                evidence: {
                  include: {
                    source: true,
                  },
                },
              },
            },
          },
        },
        itemB: {
          include: {
            sourcePointers: {
              include: {
                evidence: {
                  include: {
                    source: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.regulatoryConflict.count({ where }),
  ])

  // Filter out conflicts where itemA or itemB is null
  const validConflicts = conflicts.filter(
    (
      c
    ): c is typeof c & { itemA: NonNullable<typeof c.itemA>; itemB: NonNullable<typeof c.itemB> } =>
      c.itemA !== null && c.itemB !== null
  )

  return (
    <ConflictsView
      conflicts={validConflicts}
      total={total}
      page={page}
      pageSize={pageSize}
      userId={user.id}
    />
  )
}
