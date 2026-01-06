import { getCurrentUser } from "@/lib/auth-utils"
import { db, dbReg } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { redirect } from "next/navigation"
import { ConflictsView, type EvidenceWithSource } from "./conflicts-view"

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
    redirect("/")
  }

  const params = await searchParams
  const statusFilter = params.status as "OPEN" | "RESOLVED" | "ESCALATED" | undefined
  const page = parseInt(params.page || "1", 10)
  const pageSize = 20

  // Get conflicts
  const where: Prisma.RegulatoryConflictWhereInput = {}

  if (statusFilter) {
    where.status = statusFilter
  } else {
    // Default to open conflicts
    where.status = { in: ["OPEN"] }
  }

  // Fetch conflicts without itemA/itemB relations (they were removed)
  const [conflicts, total] = await Promise.all([
    db.regulatoryConflict.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.regulatoryConflict.count({ where }),
  ])

  // Collect all rule IDs needed from conflicts
  const ruleIds = conflicts
    .flatMap((c) => [c.itemAId, c.itemBId])
    .filter((id): id is string => id !== null)

  // Fetch all rules at once with their source pointers (without evidence - that's a soft reference)
  const rules = await db.regulatoryRule.findMany({
    where: { id: { in: ruleIds } },
    include: {
      sourcePointers: true,
    },
  })

  // Collect all evidence IDs from source pointers
  const evidenceIds = rules.flatMap((r) => r.sourcePointers.map((sp) => sp.evidenceId))

  // Fetch all evidence records from regulatory database (soft reference via evidenceId)
  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: evidenceIds } },
    include: { source: true },
  })

  // Build evidence map for quick lookup
  const evidenceMap = new Map<string, EvidenceWithSource>(
    evidenceRecords.map((e) => [
      e.id,
      {
        id: e.id,
        url: e.url,
        source: e.source
          ? {
              id: e.source.id,
              name: e.source.name,
              hierarchy: e.source.hierarchy,
            }
          : null,
      },
    ])
  )

  // Build a map for quick lookup
  const ruleMap = new Map(rules.map((r) => [r.id, r]))

  // Build conflicts with resolved itemA/itemB, filtering out those with missing rules
  const conflictsWithRules = conflicts
    .map((c) => ({
      ...c,
      itemA: c.itemAId ? (ruleMap.get(c.itemAId) ?? null) : null,
      itemB: c.itemBId ? (ruleMap.get(c.itemBId) ?? null) : null,
    }))
    .filter(
      (
        c
      ): c is typeof c & {
        itemA: NonNullable<typeof c.itemA>
        itemB: NonNullable<typeof c.itemB>
      } => c.itemA !== null && c.itemB !== null
    )

  return (
    <ConflictsView
      conflicts={conflictsWithRules}
      total={total}
      page={page}
      pageSize={pageSize}
      userId={user.id}
      evidenceMap={Object.fromEntries(evidenceMap)}
    />
  )
}
