import { NextResponse } from "next/server"
import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"

export async function POST() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    return NextResponse.json({ ok: false, reason: "NO_COMPANY" }, { status: 400 })
  }

  await db.companyUser.updateMany({
    where: {
      userId: user.id!,
      companyId: company.id,
    },
    data: {
      notificationSeenAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}
