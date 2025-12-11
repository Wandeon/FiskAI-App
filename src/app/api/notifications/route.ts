import { NextResponse } from "next/server"
import { requireAuth, getCurrentCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { getNotificationCenterFeed, countUnreadNotifications } from "@/lib/notifications"

export async function GET() {
  const user = await requireAuth()
  const company = await getCurrentCompany(user.id!)

  if (!company) {
    return NextResponse.json({
      items: [],
      unreadCount: 0,
      lastSeenAt: null,
    })
  }

  const companyUser = await db.companyUser.findFirst({
    where: { userId: user.id!, companyId: company.id },
    select: { notificationSeenAt: true },
  })

  const feed = await getNotificationCenterFeed({
    userId: user.id!,
    company: {
      id: company.id,
      name: company.name,
      eInvoiceProvider: company.eInvoiceProvider,
    },
  })

  const unreadCount = countUnreadNotifications(feed.items, companyUser?.notificationSeenAt ?? null)

  return NextResponse.json({
    items: feed.items,
    unreadCount,
    lastSeenAt: companyUser?.notificationSeenAt?.toISOString() ?? null,
  })
}
