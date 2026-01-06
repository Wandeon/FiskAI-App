import { getCurrentUser } from "@/lib/auth-utils"
import { dbReg } from "@/lib/db/regulatory"
import { redirect } from "next/navigation"
import { SourcesView } from "./sources-view"

export const revalidate = 60 // 1 minute cache

export default async function RegulatorySourcesPage() {
  const user = await getCurrentUser()

  if (!user || user.systemRole !== "ADMIN") {
    redirect("/")
  }

  // Get all regulatory sources
  const sources = await dbReg.regulatorySource.findMany({
    orderBy: [
      { hierarchy: "asc" }, // Most authoritative first
      { name: "asc" },
    ],
    include: {
      evidence: {
        orderBy: { fetchedAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          evidence: true,
        },
      },
    },
  })

  return <SourcesView sources={sources} />
}
