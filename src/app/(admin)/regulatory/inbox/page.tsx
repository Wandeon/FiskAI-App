import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { dbReg } from "@/lib/db/regulatory"
import { Prisma } from "@prisma/client"
import { redirect } from "next/navigation"
import { InboxView, type RuleWithSourcePointers } from "./inbox-view"

export const revalidate = 0 // Always fetch fresh data

interface SearchParams {
  riskTier?: string
  page?: string
}

export default async function RegulatoryInboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getCurrentUser()

  if (!user || user.systemRole !== "ADMIN") {
    redirect("/")
  }

  const params = await searchParams
  const riskTierFilter = params.riskTier as "T0" | "T1" | "T2" | "T3" | undefined
  const page = parseInt(params.page || "1", 10)
  const pageSize = 20

  // Get rules pending review
  const where: Prisma.RegulatoryRuleWhereInput = {
    status: "PENDING_REVIEW",
  }

  if (riskTierFilter) {
    where.riskTier = riskTierFilter
  }

  const [rulesRaw, total] = await Promise.all([
    db.regulatoryRule.findMany({
      where,
      orderBy: [
        { riskTier: "asc" }, // T0 first
        { createdAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sourcePointers: true,
      },
    }),
    db.regulatoryRule.count({ where }),
  ])

  // Fetch evidence from regulatory db
  const allEvidenceIds = new Set<string>()
  for (const rule of rulesRaw) {
    for (const sp of rule.sourcePointers) {
      allEvidenceIds.add(sp.evidenceId)
    }
  }

  const evidenceRecords = await dbReg.evidence.findMany({
    where: { id: { in: Array.from(allEvidenceIds) } },
    include: { source: true },
  })
  const evidenceMap = new Map(evidenceRecords.map((e) => [e.id, e]))

  // Join evidence to rules
  const rules: RuleWithSourcePointers[] = rulesRaw.map((rule) => ({
    ...rule,
    sourcePointers: rule.sourcePointers.map((sp) => {
      const evidence = evidenceMap.get(sp.evidenceId)
      return {
        ...sp,
        evidence: evidence
          ? {
              id: evidence.id,
              url: evidence.url,
              source: evidence.source
                ? { name: evidence.source.name, slug: evidence.source.slug }
                : undefined,
            }
          : undefined,
      }
    }),
  }))

  return <InboxView rules={rules} total={total} page={page} pageSize={pageSize} userId={user.id} />
}
