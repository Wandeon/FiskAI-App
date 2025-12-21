import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { InboxView } from "./inbox-view"

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
    redirect("/dashboard")
  }

  const params = await searchParams
  const riskTierFilter = params.riskTier as "T0" | "T1" | "T2" | "T3" | undefined
  const page = parseInt(params.page || "1", 10)
  const pageSize = 20

  // Get rules pending review
  const where: any = {
    status: "PENDING_REVIEW",
  }

  if (riskTierFilter) {
    where.riskTier = riskTierFilter
  }

  const [rules, total] = await Promise.all([
    db.regulatoryRule.findMany({
      where,
      orderBy: [
        { riskTier: "asc" }, // T0 first
        { createdAt: "desc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
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
    }),
    db.regulatoryRule.count({ where }),
  ])

  return <InboxView rules={rules} total={total} page={page} pageSize={pageSize} userId={user.id} />
}
