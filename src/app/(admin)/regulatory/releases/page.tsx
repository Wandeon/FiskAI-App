import { getCurrentUser } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { ReleasesView } from "./releases-view"

export const revalidate = 60 // 1 minute cache

export default async function RegulatoryReleasesPage() {
  const user = await getCurrentUser()

  if (!user || user.systemRole !== "ADMIN") {
    redirect("/dashboard")
  }

  // Get all rule releases
  const releases = await db.ruleRelease.findMany({
    orderBy: { releasedAt: "desc" },
    include: {
      _count: {
        select: {
          rules: true,
        },
      },
    },
  })

  return <ReleasesView releases={releases} />
}
