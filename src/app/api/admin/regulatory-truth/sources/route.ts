import { NextResponse } from "next/server"
import { dbReg } from "@/lib/db/regulatory"
import { getCurrentUser } from "@/lib/auth-utils"

export async function GET() {
  const user = await getCurrentUser()

  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const sources = await dbReg.regulatorySource.findMany({
    orderBy: { lastFetchedAt: "desc" },
    include: {
      _count: {
        select: {
          evidence: true,
          monitoringAlerts: true,
        },
      },
    },
  })

  return NextResponse.json({ sources })
}
