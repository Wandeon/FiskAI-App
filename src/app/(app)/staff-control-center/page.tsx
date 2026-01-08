// src/app/(app)/staff-control-center/page.tsx
/**
 * Accountant Control Center
 *
 * Shows review queues and client oversight for staff.
 * All data comes from capability resolution.
 *
 * @since Control Center Shells
 */

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { ControlCenterShell, QueueRenderer, type QueueItem } from "@/components/capability"
import { resolveCapabilitiesForUser } from "@/lib/capabilities/server"
import { ACCOUNTANT_QUEUES } from "./queues"

export const metadata = {
  title: "Accountant Control Center | FiskAI",
}

async function getQueueItems(
  queue: (typeof ACCOUNTANT_QUEUES)[number],
  userId: string
): Promise<QueueItem[]> {
  // Get staff assignments - schema uses staffId field
  let assignedCompanyIds: string[] = []

  try {
    const assignments = await db.staffAssignment.findMany({
      where: { staffId: userId },
      select: { companyId: true },
    })
    assignedCompanyIds = assignments.map((a) => a.companyId)
  } catch {
    // staffAssignment table may not exist - get from user's companies
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { companyId: true } } },
    })
    assignedCompanyIds = user?.companies?.map((c) => c.companyId) ?? []
  }

  if (assignedCompanyIds.length === 0) return []

  let entities: Array<{
    id: string
    title: string
    status: string
    timestamp: string
  }> = []

  switch (queue.entityType) {
    case "Company": {
      const companies = await db.company.findMany({
        where: { id: { in: assignedCompanyIds } },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        take: 10,
      })
      entities = companies.map((c) => ({
        id: c.id,
        title: c.name,
        status: "ASSIGNED",
        timestamp: c.createdAt.toISOString(),
      }))
      break
    }
    case "AccountingPeriod": {
      // Period lock requests - placeholder for Phase 2
      // Will query accountingPeriod with OPEN status
      entities = []
      break
    }
    case "Invitation": {
      // Placeholder - invitations would be fetched differently
      entities = []
      break
    }
  }

  // Resolve capabilities for each entity
  const items: QueueItem[] = await Promise.all(
    entities.map(async (entity) => {
      const capabilities = await resolveCapabilitiesForUser(queue.capabilityIds, {
        entityId: entity.id,
        entityType: queue.entityType,
      })
      return {
        id: entity.id,
        type: queue.entityType,
        title: entity.title,
        status: entity.status,
        timestamp: entity.timestamp,
        capabilities,
      }
    })
  )

  return items
}

export default async function AccountantControlCenterPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/auth")
  }

  // Verify user is STAFF
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  })

  if (user?.systemRole !== "STAFF" && user?.systemRole !== "ADMIN") {
    redirect("/")
  }

  // Fetch items for all queues
  const queueData = await Promise.all(
    ACCOUNTANT_QUEUES.map(async (queue) => ({
      queue,
      items: await getQueueItems(queue, session.user.id),
    }))
  )

  return (
    <ControlCenterShell title="Client Oversight" role="Accountant">
      {queueData.map(({ queue, items }) => (
        <QueueRenderer
          key={queue.id}
          queue={queue}
          items={items}
          emptyMessage={`No ${queue.name.toLowerCase()}`}
        />
      ))}
    </ControlCenterShell>
  )
}
