/**
 * Layout Query Functions
 *
 * Database queries for layout components, extracted for Clean Architecture compliance.
 * Components in src/components should not import @prisma/client or @/lib/db directly.
 */

import { db } from "@/lib/db"

/**
 * Get notification seen timestamp for a user in a company
 */
export async function getNotificationSeenAt(userId: string, companyId: string) {
  const companyUser = await db.companyUser.findFirst({
    where: { userId, companyId },
    select: { notificationSeenAt: true },
  })
  return companyUser?.notificationSeenAt ?? null
}
